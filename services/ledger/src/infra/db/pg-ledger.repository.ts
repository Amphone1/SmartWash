/**
 * Postgres adapter for the append-only ledger. The post path runs inside one
 * transaction with a per-user advisory lock so balance_after is computed
 * race-free, dedups on the UNIQUE idempotency_key, and writes the LedgerPosted
 * outbox row atomically with the entry (rules #2, #3, #4).
 */
import { Injectable } from '@nestjs/common';
import { IdempotencyConflictError, InsufficientFundsError } from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import { nextBalance, type LedgerEntryView, type PostInput } from '../../domain/ledger';
import type {
  LedgerRepository,
  PostResult,
  RefundInput,
  RefundResult,
} from '../../domain/ports';

interface Row {
  id: string;
  user_id: string;
  type: string;
  amount: string;
  balance_after: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: Date;
}

function toEntry(r: Row): LedgerEntryView {
  return {
    id: Number(r.id),
    userId: r.user_id,
    type: r.type as LedgerEntryView['type'],
    amount: BigInt(r.amount),
    balanceAfter: BigInt(r.balance_after),
    refType: r.ref_type,
    refId: r.ref_id,
    createdAt: r.created_at.toISOString(),
  };
}

@Injectable()
export class PgLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Database) {}

  async postAtomic(input: PostInput): Promise<PostResult> {
    return this.db.withTransaction(async (client) => {
      // 1) Serialize posts for this user.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.userId]);

      // 2) Dedup on idempotency_key — replay returns the same entry.
      const dup = await client.query<Row>(
        `SELECT * FROM ledger_entries WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (dup.rows[0]) {
        const e = dup.rows[0];
        if (e.type !== input.type || BigInt(e.amount) !== input.amount) {
          throw new IdempotencyConflictError();
        }
        return { entry: toEntry(e), replayed: true };
      }

      // 3) Running balance from the last entry (append-only).
      const prevRes = await client.query<{ balance_after: string }>(
        `SELECT balance_after FROM ledger_entries
          WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
        [input.userId],
      );
      const prev = prevRes.rows[0] ? BigInt(prevRes.rows[0].balance_after) : 0n;
      const balanceAfter = nextBalance(prev, input.amount);

      // 4) Overdraft guard (credit_limits deferred).
      if (balanceAfter < 0n) {
        throw new InsufficientFundsError(
          `insufficient funds: ${prev} + ${input.amount} < 0`,
        );
      }

      // 5) Append entry + LedgerPosted outbox in the same txn.
      const ins = await client.query<Row>(
        `INSERT INTO ledger_entries
           (user_id, type, amount, balance_after, ref_type, ref_id, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          input.userId,
          input.type,
          input.amount.toString(),
          balanceAfter.toString(),
          input.refType,
          input.refId,
          input.idempotencyKey,
        ],
      );
      const entry = ins.rows[0];

      await insertOutbox(client, {
        aggregateType: 'ledger',
        aggregateId: input.userId,
        eventType: 'smartwash.ledger.posted.v1',
        payload: {
          ledgerId: Number(entry.id),
          userId: input.userId,
          type: input.type,
          amount: Number(entry.amount),
          balanceAfter: Number(entry.balance_after),
        },
      });

      return { entry: toEntry(entry), replayed: false };
    });
  }

  async postRefund(input: RefundInput): Promise<RefundResult> {
    return this.db.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.userId]);

      // Dedup — replay returns the same entry + refund row (never double-refund).
      const dup = await client.query<Row>(
        `SELECT * FROM ledger_entries WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (dup.rows[0]) {
        const e = dup.rows[0];
        if (e.type !== 'REFUND_REVERSAL' || BigInt(e.amount) !== input.amount) {
          throw new IdempotencyConflictError();
        }
        const rf = await client.query<{ id: string }>(
          `SELECT id FROM refunds WHERE ledger_id = $1`,
          [e.id],
        );
        return { entry: toEntry(e), refundId: rf.rows[0]?.id ?? '', replayed: true };
      }

      const prevRes = await client.query<{ balance_after: string }>(
        `SELECT balance_after FROM ledger_entries
          WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
        [input.userId],
      );
      const prev = prevRes.rows[0] ? BigInt(prevRes.rows[0].balance_after) : 0n;
      const balanceAfter = nextBalance(prev, input.amount); // refund credits back

      const ins = await client.query<Row>(
        `INSERT INTO ledger_entries
           (user_id, type, amount, balance_after, ref_type, ref_id, idempotency_key)
         VALUES ($1,'REFUND_REVERSAL',$2,$3,'refund',$4,$5) RETURNING *`,
        [
          input.userId,
          input.amount.toString(),
          balanceAfter.toString(),
          input.orderId,
          input.idempotencyKey,
        ],
      );
      const entry = ins.rows[0];

      // Record the refund (closes the audit gap) referencing the ledger entry.
      const rf = await client.query<{ id: string }>(
        `INSERT INTO refunds (order_id, user_id, type, amount, reason, state, ledger_id)
         VALUES ($1,$2,$3,$4,$5,'REVERSED',$6) RETURNING id`,
        [input.orderId, input.userId, input.type, input.amount.toString(), input.reason ?? null, entry.id],
      );

      await insertOutbox(client, {
        aggregateType: 'ledger',
        aggregateId: input.userId,
        eventType: 'smartwash.ledger.posted.v1',
        payload: {
          ledgerId: Number(entry.id),
          userId: input.userId,
          type: 'REFUND_REVERSAL',
          amount: Number(entry.amount),
          balanceAfter: Number(entry.balance_after),
        },
      });

      return { entry: toEntry(entry), refundId: rf.rows[0].id, replayed: false };
    });
  }

  async listEntries(
    userId: string,
    limit: number,
    cursor: number | null,
  ): Promise<LedgerEntryView[]> {
    const params: unknown[] = [userId];
    let where = 'user_id = $1';
    if (cursor !== null) {
      params.push(cursor);
      where += ` AND id < $${params.length}`;
    }
    params.push(limit);
    const { rows } = await this.db
      .getPool()
      .query<Row>(
        `SELECT * FROM ledger_entries WHERE ${where} ORDER BY id DESC LIMIT $${params.length}`,
        params,
      );
    return rows.map(toEntry);
  }
}
