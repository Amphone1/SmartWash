/**
 * Wallet projection admin (ops-only) — EPIC A · A8 seeding.
 *
 * Rebuilds the A7 `wallet_balances` cache from the authoritative ledger. This is
 * required to SEED the projection before an A8 shadow/serve bake: a cold
 * `wallet_balances` otherwise shows permanent projection==legacy drift. Idempotent.
 *
 * Must run OFFLINE — with the A7 projector paused (`WALLET_PROJECTOR_V2_ENABLED`
 * off) — to avoid racing the live `applyV2` writes; the endpoint refuses while the
 * projector is enabled unless `force=true`.
 *
 * Internal-only (`InternalTokenGuard`, like `POST /ledger/post`). Two modes:
 *  - `ledger_entries` (default): transition rebuild — total into `available`,
 *    reserved/held/pending = 0 (legacy has no split). Matches projection==legacy.
 *  - `postings`: full-fidelity rebuild — true four-way split (post-backfill/canonical).
 */
import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { InternalTokenGuard, optionalEnv } from '@smartwash/nestkit';
import { ConflictError, ValidationError } from '@smartwash/common';
import { PgWalletProjectionRepository } from '../infra/db/pg-wallet-projection.repository';

type RebuildMode = 'ledger_entries' | 'postings';

@Controller('internal/wallet')
@UseGuards(InternalTokenGuard)
export class WalletAdminController {
  constructor(private readonly projection: PgWalletProjectionRepository) {}

  /**
   * POST /internal/wallet/rebuild?mode=ledger_entries|postings&force=true
   * Reseeds `wallet_balances` from the ledger. Refuses while the projector is
   * enabled (rebuild must run offline) unless `force=true`. Returns the row count.
   */
  @Post('rebuild')
  async rebuild(
    @Query('mode') mode = 'ledger_entries',
    @Query('force') force?: string,
  ): Promise<{ mode: RebuildMode; rows: number }> {
    if (mode !== 'ledger_entries' && mode !== 'postings') {
      throw new ValidationError(`unknown rebuild mode: ${mode}`);
    }
    const projectorOn =
      optionalEnv('WALLET_PROJECTOR_V2_ENABLED', 'false') === 'true';
    if (projectorOn && force !== 'true') {
      throw new ConflictError(
        'A7 projector is enabled — pause it (WALLET_PROJECTOR_V2_ENABLED=off) or pass force=true to rebuild offline',
      );
    }
    const rows =
      mode === 'postings'
        ? await this.projection.rebuildFromPostings()
        : await this.projection.rebuildFromLedgerEntries();
    return { mode, rows };
  }
}
