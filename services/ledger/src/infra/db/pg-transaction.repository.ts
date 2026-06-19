/**
 * Postgres adapter for the double-entry ledger write path (EPIC A · A4).
 *
 * `post()` persists a balanced A3 `TransactionIntent` atomically:
 *   1) replay — same idempotency_key returns the stored txn (no re-insert/outbox)
 *   2) resolve every account (A2 get-or-create) within the txn
 *   3) advisory-lock all touched accounts in sorted id order (deadlock-free)
 *   4) read each account's current natural balance
 *   5) insert the journal header (idempotency_key UNIQUE backstop; race → replay)
 *   6) per posting: balance_after = natural running balance; overdraft guard; insert
 *   7) emit smartwash.ledger.transaction.posted.v2 to the outbox (same txn)
 *
 * UNUSED by live flows until A5 (dual-write). Preserves append-only + double-entry
 * (the A1 deferred balanced trigger is the final backstop).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import {
  IdempotencyConflictError,
  InsufficientFundsError,
  type Kip,
} from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import { type AcctType, type OwnerType } from '../../domain/accounts';
import { naturalDelta, violatesOverdraft } from '../../domain/balance';
import { type TransactionIntent } from '../../domain/posting-rules';
import {
  ACCOUNT_RESOLVER,
  type AccountResolver,
  type PostTransactionResult,
  type PostedPosting,
  type TransactionRepository,
} from '../../domain/ports';

/** Ledger txns with no entity owner (e.g. platform-only adjustment) use this aggregate. */
const SYSTEM_AGGREGATE = '00000000-0000-0000-0000-000000000000';

interface ResolvedRef {
  id: bigint;
  acctType: AcctType;
  ownerType: OwnerType;
  ownerId: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}

@Injectable()
export class PgTransactionRepository implements TransactionRepository {
  constructor(
    private readonly db: Database,
    @Inject(ACCOUNT_RESOLVER) private readonly accounts: AccountResolver,
  ) {}

  async post(intent: TransactionIntent): Promise<PostTransactionResult> {
    return this.db.withTransaction(async (client) => {
      // 1) Replay: a known key returns the stored transaction unchanged.
      const dup = await client.query<{ id: string; type: string }>(
        `SELECT id, type FROM ledger_transactions WHERE idempotency_key = $1`,
        [intent.idempotencyKey],
      );
      if (dup.rows[0]) {
        return this.loadReplay(client, dup.rows[0], intent);
      }

      // 2) Resolve every distinct account (get-or-create) within this txn.
      const resolved = new Map<string, ResolvedRef>();
      for (const p of intent.postings) {
        if (!resolved.has(p.accountKey)) {
          const r = await this.accounts.resolve(client, p.account);
          resolved.set(p.accountKey, {
            id: r.id,
            acctType: r.acctType,
            ownerType: p.account.ownerType,
            ownerId: p.account.ownerId ?? null,
          });
        }
      }

      // 3) Advisory-lock all touched accounts in a deterministic order (no deadlock).
      const ids = [...new Set([...resolved.values()].map((v) => v.id))].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      for (const id of ids) {
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [id.toString()]);
      }

      // 4) Current natural balance per account (read after locking).
      const balances = new Map<string, Kip>();
      for (const id of ids) {
        const r = await client.query<{ balance_after: string }>(
          `SELECT balance_after FROM ledger_postings
            WHERE account_id = $1 ORDER BY id DESC LIMIT 1`,
          [id.toString()],
        );
        balances.set(id.toString(), r.rows[0] ? BigInt(r.rows[0].balance_after) : 0n);
      }

      // 5) Insert the journal header (UNIQUE idempotency_key backstop).
      let txnId: bigint;
      try {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO ledger_transactions (type, correlation_id, idempotency_key)
           VALUES ($1, $2, $3) RETURNING id`,
          [intent.type, intent.correlationId ?? null, intent.idempotencyKey],
        );
        txnId = BigInt(ins.rows[0].id);
      } catch (e) {
        if (isUniqueViolation(e)) {
          const again = await client.query<{ id: string; type: string }>(
            `SELECT id, type FROM ledger_transactions WHERE idempotency_key = $1`,
            [intent.idempotencyKey],
          );
          return this.loadReplay(client, again.rows[0], intent);
        }
        throw e;
      }

      // 6) Compute balance_after (natural sign), guard overdraft, insert each posting.
      const out: PostedPosting[] = [];
      for (const p of intent.postings) {
        const acct = resolved.get(p.accountKey) as ResolvedRef;
        const key = acct.id.toString();
        const next = (balances.get(key) ?? 0n) + naturalDelta(acct.acctType, p.direction, p.amount);
        if (violatesOverdraft(acct.ownerType, next)) {
          throw new InsufficientFundsError(
            `overdraft on ${p.accountKey}: balance would be ${next}`,
          );
        }
        balances.set(key, next);
        await client.query(
          `INSERT INTO ledger_postings (txn_id, account_id, direction, amount, balance_after)
           VALUES ($1, $2, $3, $4, $5)`,
          [txnId.toString(), key, p.direction, p.amount.toString(), next.toString()],
        );
        out.push({
          accountId: acct.id,
          accountKey: p.accountKey,
          ownerType: acct.ownerType,
          ownerId: acct.ownerId,
          direction: p.direction,
          amount: p.amount,
          balanceAfter: next,
        });
      }

      // 7) Emit posted.v2 (kip as decimal strings — BIGINT precision, rule #1).
      const userId = out.find((o) => o.ownerType === 'user')?.ownerId ?? null;
      const aggregateId = userId ?? out.find((o) => o.ownerId !== null)?.ownerId ?? SYSTEM_AGGREGATE;
      await insertOutbox(client, {
        aggregateType: 'ledger',
        aggregateId,
        eventType: 'smartwash.ledger.transaction.posted.v2',
        payload: {
          txnId: txnId.toString(),
          type: intent.type,
          userId,
          postings: out.map((o) => ({
            accountKey: o.accountKey,
            ownerType: o.ownerType,
            ownerId: o.ownerId,
            direction: o.direction,
            amount: o.amount.toString(),
            balanceAfter: o.balanceAfter.toString(),
          })),
        },
      });

      return { txnId, type: intent.type, postings: out, replayed: false };
    });
  }

  /** Load and return a stored transaction for a replayed key (no side effects). */
  private async loadReplay(
    client: PoolClient,
    row: { id: string; type: string },
    intent: TransactionIntent,
  ): Promise<PostTransactionResult> {
    // Same key + different material payload (type or total DR) → conflict.
    const intentDr = intent.postings
      .filter((p) => p.direction === 'DR')
      .reduce((s, p) => s + p.amount, 0n);
    const stored = await client.query<{
      account_id: string;
      direction: string;
      amount: string;
      balance_after: string;
      total_dr: string;
    }>(
      `SELECT p.account_id, p.direction, p.amount, p.balance_after,
              (SELECT COALESCE(SUM(amount) FILTER (WHERE direction='DR'),0)
                 FROM ledger_postings WHERE txn_id = $1)::text AS total_dr
         FROM ledger_postings p WHERE p.txn_id = $1 ORDER BY p.id ASC`,
      [row.id],
    );
    const totalDr = stored.rows[0] ? BigInt(stored.rows[0].total_dr) : 0n;
    if (row.type !== intent.type || totalDr !== intentDr) {
      throw new IdempotencyConflictError();
    }
    const postings: PostedPosting[] = stored.rows.map((r) => ({
      accountId: BigInt(r.account_id),
      accountKey: '', // surrogate-only on replay; callers key off accountId
      ownerType: '',
      ownerId: null,
      direction: r.direction as PostedPosting['direction'],
      amount: BigInt(r.amount),
      balanceAfter: BigInt(r.balance_after),
    }));
    return { txnId: BigInt(row.id), type: row.type, postings, replayed: true };
  }
}
