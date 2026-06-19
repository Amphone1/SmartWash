/**
 * A5 dual-write integration tests — drift validation + fail-open + flag controls.
 * Drives the LEGACY write path (`postAtomic`) with the shadow mirror enabled and
 * asserts: (a) flag-off = no mirror; (b) enabled = zero drift; (c) a mirror failure
 * is fail-open (legacy commits, mirror rolled back to savepoint).
 *
 * Requires DATABASE_URL; self-skips otherwise. Random UUIDs keep rows isolated.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Database } from '@smartwash/nestkit';
import { PgAccountRepository } from './pg-account.repository';
import { PgTransactionRepository } from './pg-transaction.repository';
import { PgLedgerRepository } from './pg-ledger.repository';
import { DualWriteShim } from '../../application/dual-write.shim';

const DBURL = process.env.DATABASE_URL;
const suite = DBURL ? describe : describe.skip;

suite('A5 dual-write [requires DATABASE_URL]', () => {
  let pool: Pool;
  let repo: PgLedgerRepository;

  beforeAll(() => {
    pool = new Pool({ connectionString: DBURL });
    const db = new Database(pool);
    const shim = new DualWriteShim(new PgTransactionRepository(db, new PgAccountRepository()));
    repo = new PgLedgerRepository(db, shim);
  });
  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    delete process.env.LEDGER_DUAL_WRITE_MODE;
    delete process.env.LEDGER_DUAL_WRITE_FLOWS;
  });

  async function seed(userId: string, branchId: string): Promise<void> {
    await pool.query(`INSERT INTO users (id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
      userId,
      `+85620${userId.replace(/-/g, '').slice(0, 9)}`,
      `dw-${userId.slice(0, 8)}`,
    ]);
    await pool.query(`INSERT INTO branches (id, name, lat, lng) VALUES ($1,$2,0,0) ON CONFLICT DO NOTHING`, [
      branchId,
      `dw-branch-${branchId.slice(0, 8)}`,
    ]);
  }

  async function newCurrent(userId: string): Promise<bigint> {
    const r = await pool.query<{ current: string }>(
      `SELECT COALESCE(SUM(b.balance_after),0)::text AS current FROM accounts a
       CROSS JOIN LATERAL (SELECT balance_after FROM ledger_postings WHERE account_id=a.id ORDER BY id DESC LIMIT 1) b
       WHERE a.owner_type='user' AND a.owner_id=$1`,
      [userId],
    );
    return BigInt(r.rows[0].current);
  }

  async function newTxnCount(idempotencyKey: string): Promise<number> {
    const r = await pool.query<{ c: string }>(
      `SELECT count(*) c FROM ledger_transactions WHERE idempotency_key=$1`,
      [idempotencyKey],
    );
    return Number(r.rows[0].c);
  }

  it('flag OFF (default): legacy write only, no mirror', async () => {
    const u = randomUUID();
    const b = randomUUID();
    const ref = randomUUID();
    await seed(u, b);
    await repo.postAtomic({
      userId: u, type: 'TOPUP', amount: 50000n, refType: 'topup', refId: ref,
      idempotencyKey: randomUUID(), branchId: b,
    });
    expect(await newCurrent(u)).toBe(0n); // nothing mirrored
    expect(await newTxnCount(`topup:dual:${ref}`)).toBe(0);
  });

  it('topup enabled: mirrors TOPUP+SETTLE with ZERO drift', async () => {
    process.env.LEDGER_DUAL_WRITE_MODE = 'shadow_fail_open';
    process.env.LEDGER_DUAL_WRITE_FLOWS = 'topup';
    const u = randomUUID();
    const b = randomUUID();
    const ref = randomUUID();
    await seed(u, b);
    await repo.postAtomic({
      userId: u, type: 'TOPUP', amount: 50000n, refType: 'topup', refId: ref,
      idempotencyKey: randomUUID(), branchId: b,
    });
    expect(await newTxnCount(`topup:dual:${ref}`)).toBe(1);
    expect(await newTxnCount(`topup-settle:dual:${ref}`)).toBe(1);
    expect(await newCurrent(u)).toBe(50000n); // == legacy balance → zero drift
  });

  it('topup + wash sequence: new current tracks legacy balance (zero drift)', async () => {
    process.env.LEDGER_DUAL_WRITE_MODE = 'shadow_fail_open';
    process.env.LEDGER_DUAL_WRITE_FLOWS = 'topup,wash';
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    await repo.postAtomic({
      userId: u, type: 'TOPUP', amount: 50000n, refType: 'topup', refId: randomUUID(),
      idempotencyKey: randomUUID(), branchId: b,
    });
    expect(await newCurrent(u)).toBe(50000n);
    const order = randomUUID();
    const ded = await repo.postAtomic({
      userId: u, type: 'DEDUCT', amount: -22000n, refType: 'order', refId: order,
      idempotencyKey: randomUUID(), branchId: b, vatBps: 1000, channel: 'wash',
    });
    expect(ded.entry.balanceAfter).toBe(28000n);        // legacy
    expect(await newCurrent(u)).toBe(28000n);            // new current == legacy
    expect(await newTxnCount(`reserve:dual:${order}`)).toBe(1);
    expect(await newTxnCount(`wash-deduct:dual:${order}`)).toBe(1);
  });

  it('FAIL-OPEN: a mirror failure does not abort the legacy write', async () => {
    // Fund legacy WITHOUT mirroring (topup flow off) → new available stays 0.
    const u = randomUUID();
    const b = randomUUID();
    await seed(u, b);
    await repo.postAtomic({
      userId: u, type: 'TOPUP', amount: 50000n, refType: 'topup', refId: randomUUID(),
      idempotencyKey: randomUUID(), branchId: b,
    });
    // Now enable wash only and DEDUCT → mirror RESERVE overdraws (new available=0) → fail-open.
    process.env.LEDGER_DUAL_WRITE_MODE = 'shadow_fail_open';
    process.env.LEDGER_DUAL_WRITE_FLOWS = 'wash';
    const order = randomUUID();
    const ded = await repo.postAtomic({
      userId: u, type: 'DEDUCT', amount: -22000n, refType: 'order', refId: order,
      idempotencyKey: randomUUID(), branchId: b, vatBps: 1000, channel: 'wash',
    });
    // Legacy committed (authoritative) …
    expect(ded.entry.balanceAfter).toBe(28000n);
    const legacy = await pool.query(`SELECT 1 FROM ledger_entries WHERE ref_id=$1 AND user_id=$2`, [order, u]);
    expect(legacy.rowCount).toBe(1);
    // … and the mirror was rolled back to the savepoint (no new rows).
    expect(await newTxnCount(`reserve:dual:${order}`)).toBe(0);
    expect(await newTxnCount(`wash-deduct:dual:${order}`)).toBe(0);
    expect(await newCurrent(u)).toBe(0n);
  });
});
