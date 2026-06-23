/**
 * A4 integration tests for postTransaction — the gate: balanced · replay ·
 * concurrency · overdraft. Requires a real Postgres with the schema applied;
 * self-skips when DATABASE_URL is unset (so `nx test ledger` stays green locally).
 * In CI the build-test job sets DATABASE_URL after `migrate`.
 *
 * Uses random UUIDs + keys so committed rows are isolated (append-only ledger
 * cannot be cleaned; the CI/throwaway DB is ephemeral).
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Database } from '@smartwash/nestkit';
import { IdempotencyConflictError, InsufficientFundsError } from '@smartwash/common';
import { PgAccountRepository } from './pg-account.repository';
import { PgTransactionRepository } from './pg-transaction.repository';
import type { PostTransactionResult } from '../../domain/ports';
import { buildTopup, buildTopupSettle, buildReserve } from '../../domain/posting-rules';

const DBURL = process.env.DATABASE_URL;
const suite = DBURL ? describe : describe.skip;

suite('A4 postTransaction [requires DATABASE_URL]', () => {
  let pool: Pool;
  let repo: PgTransactionRepository;

  beforeAll(() => {
    pool = new Pool({ connectionString: DBURL });
    repo = new PgTransactionRepository(new Database(pool), new PgAccountRepository());
  });
  afterAll(async () => {
    await pool.end();
  });

  // Owner rows must exist (resolveAccount checks owner existence).
  async function seed(userId: string, branchId: string): Promise<void> {
    await pool.query(`INSERT INTO users (id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
      userId,
      `+85620${userId.replace(/-/g, '').slice(0, 9)}`,
      `it-${userId.slice(0, 8)}`,
    ]);
    await pool.query(`INSERT INTO branches (id, name, lat, lng) VALUES ($1,$2,0,0) ON CONFLICT DO NOTHING`, [
      branchId,
      `it-branch-${branchId.slice(0, 8)}`,
    ]);
  }

  async function fundAvailable(userId: string, branchId: string, amount: bigint): Promise<void> {
    const qr = randomUUID();
    await repo.post(buildTopup({ qrRef: qr, userId, branchId, amount }));
    await repo.post(buildTopupSettle({ qrRef: qr, userId, branchId, amount }));
  }

  const balOf = (res: PostTransactionResult, key: string): bigint | undefined =>
    res.postings.find((p) => p.accountKey === key)?.balanceAfter;

  async function currentBalance(userId: string, sub: string): Promise<bigint> {
    const r = await pool.query<{ balance_after: string }>(
      `SELECT p.balance_after FROM ledger_postings p JOIN accounts a ON a.id = p.account_id
        WHERE a.owner_type='user' AND a.sub=$2 AND a.owner_id=$1 ORDER BY p.id DESC LIMIT 1`,
      [userId, sub],
    );
    return r.rows[0] ? BigInt(r.rows[0].balance_after) : 0n;
  }

  async function outboxV2Count(txnId: bigint): Promise<number> {
    const r = await pool.query<{ c: string }>(
      `SELECT count(*) c FROM outbox
        WHERE event_type='smartwash.ledger.transaction.posted.v2' AND payload->>'txnId' = $1`,
      [txnId.toString()],
    );
    return Number(r.rows[0].c);
  }

  it('persists a balanced TOPUP with natural-sign balance_after', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    const res = await repo.post(buildTopup({ qrRef: randomUUID(), userId: u, branchId: b, amount: 50000n }));
    expect(res.replayed).toBe(false);
    expect(balOf(res, `pending:user:${u}`)).toBe(50000n); // LIABILITY CR → +
    expect(balOf(res, `clearing:branch:${b}`)).toBe(50000n); // ASSET DR → +
    expect(await outboxV2Count(res.txnId)).toBe(1);
  });

  it('TOPUP_SETTLE moves pending → available', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    const qr = randomUUID();
    await repo.post(buildTopup({ qrRef: qr, userId: u, branchId: b, amount: 50000n }));
    const s = await repo.post(buildTopupSettle({ qrRef: qr, userId: u, branchId: b, amount: 50000n }));
    expect(balOf(s, `pending:user:${u}`)).toBe(0n);
    expect(balOf(s, `available:user:${u}`)).toBe(50000n);
  });

  it('replays an identical key — no second posting, no second outbox', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    const intent = buildTopup({ qrRef: randomUUID(), userId: u, branchId: b, amount: 50000n });
    const first = await repo.post(intent);
    const second = await repo.post(intent);
    expect(second.replayed).toBe(true);
    expect(second.txnId).toBe(first.txnId);
    const postings = await pool.query<{ c: string }>(
      `SELECT count(*) c FROM ledger_postings WHERE txn_id=$1`,
      [first.txnId.toString()],
    );
    expect(Number(postings.rows[0].c)).toBe(2);
    expect(await outboxV2Count(first.txnId)).toBe(1);
  });

  it('rejects a reused key with a different payload (IdempotencyConflict)', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    const qr = randomUUID();
    await repo.post(buildTopup({ qrRef: qr, userId: u, branchId: b, amount: 50000n }));
    await expect(
      repo.post(buildTopup({ qrRef: qr, userId: u, branchId: b, amount: 99999n })),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('rejects a RESERVE that overdraws available (InsufficientFunds), balance unchanged', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    await fundAvailable(u, b, 20000n);
    await expect(
      repo.post(buildReserve({ orderId: randomUUID(), userId: u, amount: 999999n })),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await currentBalance(u, 'available')).toBe(20000n);
  });

  it('serializes concurrent RESERVEs on one wallet — exactly one wins (no lost update)', async () => {
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    await fundAvailable(u, b, 20000n); // available = 20000; two 15000 reserves can't both pass
    const results = await Promise.allSettled([
      repo.post(buildReserve({ orderId: randomUUID(), userId: u, amount: 15000n })),
      repo.post(buildReserve({ orderId: randomUUID(), userId: u, amount: 15000n })),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientFundsError);
    expect(await currentBalance(u, 'available')).toBe(5000n); // exactly one 15000 applied
  });
});
