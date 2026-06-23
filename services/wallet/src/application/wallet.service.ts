import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import { optionalEnv } from '@smartwash/nestkit';
import {
  WALLET_REPOSITORY,
  type LedgerPosted,
  type WalletRepository,
  type WalletView,
} from '../domain/ports';
import { PgWalletProjectionRepository } from '../infra/db/pg-wallet-projection.repository';
import {
  walletReadDriftKip,
  walletReadDriftTotal,
} from '../infra/metrics/projection.metrics';
import { resolveWalletReadV2 } from './read-v2-flag';

@Injectable()
export class WalletService {
  private readonly logger = new Logger('WalletService');
  /** One-time guard for the `serve`-not-implemented warning (avoid per-request spam). */
  private serveWarned = false;

  constructor(
    @Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository,
    private readonly projection: PgWalletProjectionRepository,
  ) {}

  async getBalance(userId: string): Promise<WalletView> {
    const wallet = await this.repo.get(userId);
    // A user with no ledger activity yet has an implicit zero balance.
    const legacy: WalletView = wallet ?? {
      userId,
      balance: 0,
      currency: 'LAK',
      updatedAt: new Date(0).toISOString(),
    };

    // A8a Stage-1 (SHADOW): read v2 beside legacy and record drift. The served
    // value is ALWAYS the legacy WalletView — shape and value unchanged.
    await this.shadowCompareTopup(userId, legacy);

    return legacy;
  }

  /**
   * A8a shadow read for the topup/balance flow (flag `WALLET_READ_V2_TOPUP`).
   * Compares the A7 projection's `current` to the legacy balance and records
   * drift; NEVER alters the served value. `serve` is unimplemented in A8a — it
   * warns once and behaves as `shadow`. Any failure is swallowed: a shadow read
   * must never affect the served balance.
   */
  private async shadowCompareTopup(userId: string, legacy: WalletView): Promise<void> {
    const { mode, serveRequested } = resolveWalletReadV2(
      optionalEnv('WALLET_READ_V2_TOPUP', 'off'),
    );
    if (serveRequested && !this.serveWarned) {
      this.serveWarned = true;
      this.logger.warn(
        'WALLET_READ_V2_TOPUP=serve not implemented in A8a; serving legacy',
      );
    }
    if (mode !== 'shadow') return;

    try {
      const v2 = await this.projection.getProjected(userId);
      const legacyKip = BigInt(Math.trunc(legacy.balance)); // legacy.balance is an integer kip number
      const drift = v2.current - legacyKip;
      if (drift !== 0n) {
        const abs = drift < 0n ? -drift : drift;
        walletReadDriftTotal.inc({ flow: 'topup' });
        walletReadDriftKip.observe({ flow: 'topup' }, Number(abs));
        this.logger.warn(
          `A8a shadow drift user=${userId} v2.current=${v2.current} legacy=${legacyKip} drift=${drift}`,
        );
      }
    } catch (err) {
      // Shadow read MUST NEVER affect the served balance.
      this.logger.warn(`A8a shadow read failed user=${userId}: ${String(err)}`);
    }
  }

  /** Apply a LedgerPosted event to the cached balance. */
  async onLedgerPosted(event: LedgerPosted): Promise<void> {
    if (!event?.userId || typeof event.balanceAfter !== 'number') {
      throw new NotFoundError('invalid LedgerPosted payload');
    }
    await this.repo.applyBalance(event.userId, event.balanceAfter);
  }
}
