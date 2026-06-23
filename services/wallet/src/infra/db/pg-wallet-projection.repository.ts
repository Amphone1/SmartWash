/**
 * A7 wallet four-balance projection adapter. Writes only `wallet_balances` (a
 * derived, shadow cache — the app still reads legacy `wallets` until A8). No
 * migration: `wallet_balances` exists (A1). Delta-apply on the inbox transaction
 * client → exactly-once + W1 by construction.
 */
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Database } from '@smartwash/nestkit';
import { computeWalletDeltas, type V2Payload } from '../../domain/projection';
import {
  walletL1DriftKip,
  walletL1DriftTotal,
  walletProjectionAppliedTotal,
  walletReconcileUsers,
} from '../metrics/projection.metrics';

export interface DriftRow {
  userId: string;
  current: bigint;
  posted: bigint; // Σ user ledger_postings (new ledger)
  legacy: bigint; // legacy wallets.balance
}

@Injectable()
export class PgWalletProjectionRepository {
  constructor(private readonly db: Database) {}

  /**
   * Apply one `posted.v2` to wallet_balances on the caller's transaction `client`
   * (atomic with the A6 inbox row). Delta-apply; `last_txn_id` kept as a monotonic
   * watermark. No-op when the transaction has no user leg (e.g. SETTLEMENT).
   */
  async applyV2(client: PoolClient, data: V2Payload): Promise<void> {
    if (!data.userId) return;
    const d = computeWalletDeltas(data.postings, data.userId);
    await client.query(
      `INSERT INTO wallet_balances (user_id, available, reserved, held, pending, last_txn_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         available   = wallet_balances.available + EXCLUDED.available,
         reserved    = wallet_balances.reserved  + EXCLUDED.reserved,
         held        = wallet_balances.held      + EXCLUDED.held,
         pending     = wallet_balances.pending   + EXCLUDED.pending,
         last_txn_id = GREATEST(wallet_balances.last_txn_id, EXCLUDED.last_txn_id),
         updated_at  = now()`,
      [
        data.userId,
        d.available.toString(),
        d.reserved.toString(),
        d.held.toString(),
        d.pending.toString(),
        data.txnId,
      ],
    );
    walletProjectionAppliedTotal.inc();
  }

  /**
   * L1 reconcile (report-only): per projected user, compare `current` to Σ user
   * ledger_postings (internal/W2) and to the legacy wallet balance (advance gate).
   * Emits drift metrics; returns the non-zero-drift rows.
   */
  async reconcileL1(): Promise<DriftRow[]> {
    const { rows } = await this.db.getPool().query<{
      user_id: string;
      current: string;
      posted: string;
      legacy: string;
    }>(
      `SELECT wb.user_id,
              (wb.available + wb.reserved + wb.held + wb.pending)::text AS current,
              COALESCE((
                SELECT SUM(b.balance_after) FROM accounts a
                CROSS JOIN LATERAL (
                  SELECT balance_after FROM ledger_postings WHERE account_id = a.id ORDER BY id DESC LIMIT 1
                ) b WHERE a.owner_type = 'user' AND a.owner_id = wb.user_id
              ), 0)::text AS posted,
              COALESCE((SELECT balance FROM wallets WHERE user_id = wb.user_id), 0)::text AS legacy
         FROM wallet_balances wb`,
    );

    walletReconcileUsers.set(rows.length);
    const drifts: DriftRow[] = [];
    for (const r of rows) {
      const current = BigInt(r.current);
      const posted = BigInt(r.posted);
      const legacy = BigInt(r.legacy);
      if (current !== posted) record('internal', current - posted);
      if (current !== legacy) record('legacy', current - legacy);
      if (current !== posted || current !== legacy) {
        drifts.push({ userId: r.user_id, current, posted, legacy });
      }
    }
    return drifts;

    function record(kind: 'internal' | 'legacy', delta: bigint): void {
      const abs = delta < 0n ? -delta : delta;
      walletL1DriftTotal.inc({ kind });
      walletL1DriftKip.observe({ kind }, Number(abs));
    }
  }

  /**
   * A8a per-user projected balance (money-safe). Reads the four-balance split
   * for one user from `wallet_balances`; kip stays **bigint** throughout (each sub
   * SELECTed `::text` and wrapped with `BigInt` — never `Number()`). `current` is
   * the W1 sum `available + reserved + held + pending`.
   *
   * Not-yet-projected user (no row) → all-zero bigints. On a cold projection that
   * is expected pre-seed drift; ops must `rebuildFromLedgerEntries` to seed before
   * baking A8a (see A8_IMPLEMENTATION_PLAN §6). Read-only; serves nothing in A8a.
   */
  async getProjected(userId: string): Promise<{
    available: bigint;
    reserved: bigint;
    held: bigint;
    pending: bigint;
    current: bigint;
  }> {
    const { rows } = await this.db.getPool().query<{
      available: string;
      reserved: string;
      held: string;
      pending: string;
    }>(
      `SELECT available::text, reserved::text, held::text, pending::text
         FROM wallet_balances WHERE user_id = $1`,
      [userId],
    );
    const r = rows[0];
    if (!r) {
      return { available: 0n, reserved: 0n, held: 0n, pending: 0n, current: 0n };
    }
    const available = BigInt(r.available);
    const reserved = BigInt(r.reserved);
    const held = BigInt(r.held);
    const pending = BigInt(r.pending);
    return {
      available,
      reserved,
      held,
      pending,
      current: available + reserved + held + pending, // W1
    };
  }

  /**
   * Rebuild tooling — run OFFLINE with the projector paused. Idempotent.
   *
   * (a) From legacy `ledger_entries` ONLY (transition default): reconstructs the
   * total exactly into `available` (reserved/held/pending = 0 — legacy has no
   * split). Matches the projection==legacy identity. Collapses the four-way split.
   */
  async rebuildFromLedgerEntries(): Promise<number> {
    const res = await this.db.getPool().query(
      `INSERT INTO wallet_balances (user_id, available, reserved, held, pending, last_txn_id)
       SELECT le.user_id, le.balance_after, 0, 0, 0,
              COALESCE((SELECT MAX(id) FROM ledger_transactions), 0)
         FROM (
           SELECT DISTINCT ON (user_id) user_id, balance_after
             FROM ledger_entries WHERE user_id IS NOT NULL
            ORDER BY user_id, id DESC
         ) le
       ON CONFLICT (user_id) DO UPDATE SET
         available = EXCLUDED.available, reserved = 0, held = 0, pending = 0,
         last_txn_id = EXCLUDED.last_txn_id, updated_at = now()`,
    );
    return res.rowCount ?? 0;
  }

  /**
   * (b) From the new `ledger_postings` (full fidelity, post-backfill/canonical):
   * each sub = latest natural balance of the user's matching account.
   */
  async rebuildFromPostings(): Promise<number> {
    const res = await this.db.getPool().query(
      `INSERT INTO wallet_balances (user_id, available, reserved, held, pending, last_txn_id)
       SELECT a.owner_id,
              COALESCE(SUM(b.balance_after) FILTER (WHERE a.sub = 'available'), 0),
              COALESCE(SUM(b.balance_after) FILTER (WHERE a.sub = 'reserved'), 0),
              COALESCE(SUM(b.balance_after) FILTER (WHERE a.sub = 'held'), 0),
              COALESCE(SUM(b.balance_after) FILTER (WHERE a.sub = 'pending'), 0),
              COALESCE((SELECT MAX(id) FROM ledger_transactions), 0)
         FROM accounts a
         CROSS JOIN LATERAL (
           SELECT balance_after FROM ledger_postings WHERE account_id = a.id ORDER BY id DESC LIMIT 1
         ) b
        WHERE a.owner_type = 'user'
        GROUP BY a.owner_id
       ON CONFLICT (user_id) DO UPDATE SET
         available = EXCLUDED.available, reserved = EXCLUDED.reserved,
         held = EXCLUDED.held, pending = EXCLUDED.pending,
         last_txn_id = EXCLUDED.last_txn_id, updated_at = now()`,
    );
    return res.rowCount ?? 0;
  }
}
