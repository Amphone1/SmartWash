/**
 * A5 dual-write shim. Mirrors an authoritative legacy ledger write into the new
 * double-entry ledger (A4 `postWithClient`) on the SAME transaction, isolated by a
 * SAVEPOINT so it can NEVER abort the legacy write (fail-open). Gated by feature
 * flags (default off). Then shadow-reconciles new `current` vs legacy balance.
 *
 * Guarantees: no behaviour change when disabled; legacy stays authoritative; on any
 * mirror error the mirror is rolled back to the savepoint and (in fail-open) the
 * legacy write still commits.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/ports';
import {
  type DualWriteContext,
  flowFor,
  mapLegacyToIntents,
} from '../domain/dual-write-map';
import { readDualWriteConfig } from '../config/dual-write.config';
import {
  dualWriteErrorTotal,
  dualWriteLatency,
  dualWriteTotal,
  shadowDriftKip,
  shadowDriftTotal,
} from '../infra/metrics/dual-write.metrics';

@Injectable()
export class DualWriteShim {
  private readonly logger = new Logger('DualWriteShim');

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly txn: TransactionRepository,
  ) {}

  /**
   * Mirror one legacy write. MUST be called on the legacy write's `client`, after
   * the legacy entry is inserted and before the outer transaction commits. Never
   * throws in fail-open mode.
   */
  async mirror(client: PoolClient, ctx: DualWriteContext): Promise<void> {
    const cfg = readDualWriteConfig();
    if (cfg.mode === 'off') return;
    const flow = flowFor(ctx);
    if (!cfg.flows.has(flow)) return;

    const mapped = mapLegacyToIntents(ctx);
    if ('skip' in mapped) {
      dualWriteErrorTotal.inc({ flow, reason: mapped.skip });
      return; // coverage gap, not a failure — legacy untouched
    }

    const endTimer = dualWriteLatency.startTimer({ flow });
    await client.query('SAVEPOINT dual_write');
    try {
      for (const intent of mapped.intents) {
        await this.txn.postWithClient(client, intent);
      }
      // Force the deferred balanced check now so an (impossible) imbalance is caught
      // inside the savepoint rather than at COMMIT (which would abort the legacy write).
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      await client.query('RELEASE SAVEPOINT dual_write');
      endTimer();
      dualWriteTotal.inc({ flow, result: 'ok' });
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT dual_write');
      await client.query('RELEASE SAVEPOINT dual_write');
      endTimer();
      dualWriteTotal.inc({ flow, result: 'error' });
      dualWriteErrorTotal.inc({ flow, reason: reasonOf(err) });
      this.logger.warn(
        `dual-write mirror failed (flow=${flow}, ref=${ctx.refId}): ${messageOf(err)}`,
      );
      if (cfg.mode === 'shadow_fail_closed') throw err; // staging: surface loudly
      return; // fail-open: legacy commits regardless
    }

    // Shadow reconcile (best-effort; the mirror already persisted into the outer txn).
    if (cfg.reconcile) {
      try {
        const drift = await this.drift(client, ctx.userId, ctx.legacyBalanceAfter);
        if (drift !== 0n) {
          const abs = drift < 0n ? -drift : drift;
          shadowDriftTotal.inc({ flow });
          shadowDriftKip.observe({ flow }, Number(abs));
          this.logger.error(
            `shadow drift (flow=${flow}, user=${ctx.userId}): new−legacy=${drift}`,
          );
        }
      } catch (err) {
        this.logger.warn(`shadow reconcile read failed: ${messageOf(err)}`);
      }
    }
  }

  /** new current(user) − legacy balance. 0 = no drift. */
  private async drift(
    client: PoolClient,
    userId: string,
    legacyBalanceAfter: bigint,
  ): Promise<bigint> {
    const r = await client.query<{ current: string }>(
      `SELECT COALESCE(SUM(b.balance_after), 0)::text AS current
         FROM accounts a
         CROSS JOIN LATERAL (
           SELECT balance_after FROM ledger_postings
            WHERE account_id = a.id ORDER BY id DESC LIMIT 1
         ) b
        WHERE a.owner_type = 'user' AND a.owner_id = $1`,
      [userId],
    );
    const current = BigInt(r.rows[0]?.current ?? '0');
    return current - legacyBalanceAfter;
  }
}

function reasonOf(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: string }).code;
    if (code) return `pg_${code}`;
    const name = (err as { name?: string }).name;
    if (name) return name;
  }
  return 'unknown';
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
