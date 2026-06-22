/**
 * A7 L1 reconcile job (report-only). Periodically asserts
 *   wallet_balances.current == Σ user ledger_postings   (internal / W2)
 *   wallet_balances.current == legacy wallets.balance    (projection==legacy gate)
 * and emits drift metrics. Default OFF; enforcement/freeze is A8/EPIC C.
 */
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { intEnv, optionalEnv } from '@smartwash/nestkit';
import { PgWalletProjectionRepository } from '../db/pg-wallet-projection.repository';

@Injectable()
export class WalletReconcileJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('WalletReconcileJob');
  private timer?: NodeJS.Timeout;

  constructor(private readonly projection: PgWalletProjectionRepository) {}

  onApplicationBootstrap(): void {
    if (optionalEnv('WALLET_L1_RECONCILE_ENABLED', 'false') !== 'true') return;
    const ms = intEnv('WALLET_L1_RECONCILE_MS', 60000);
    this.timer = setInterval(() => void this.runOnce(), ms);
    this.logger.log(`L1 reconcile job started (every ${ms}ms, report-only)`);
  }

  async runOnce(): Promise<void> {
    try {
      const drifts = await this.projection.reconcileL1();
      if (drifts.length > 0) {
        this.logger.error(`L1 drift on ${drifts.length} user(s): ${JSON.stringify(drifts.slice(0, 5))}`);
      }
    } catch (err) {
      this.logger.warn(`L1 reconcile failed: ${String(err)}`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
