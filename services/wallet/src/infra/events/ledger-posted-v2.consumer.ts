/**
 * A7 wallet four-balance projector. Consumes `smartwash.ledger.transaction.posted.v2`
 * through the A6 ReliableConsumer (exactly-once inbox + DLQ) and delta-applies it to
 * `wallet_balances`. SHADOW — the app still reads legacy `wallets` (no read cutover).
 *
 * Gated by WALLET_PROJECTOR_V2_ENABLED (default OFF) → ships dark, zero behaviour
 * change. The legacy v1 LedgerPostedConsumer is untouched.
 */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  Database,
  EVENT_BUS,
  ReliableConsumer,
  intEnv,
  optionalEnv,
  type EventBus,
} from '@smartwash/nestkit';
import { extractV2 } from '../../domain/projection';
import { PgWalletProjectionRepository } from '../db/pg-wallet-projection.repository';

const SUBJECT = 'smartwash.ledger.transaction.posted.v2';
const DURABLE = 'wallet-projector-v2';

@Injectable()
export class LedgerPostedV2Consumer implements OnApplicationBootstrap {
  private readonly logger = new Logger('LedgerPostedV2Consumer');

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly db: Database,
    private readonly projection: PgWalletProjectionRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (optionalEnv('WALLET_PROJECTOR_V2_ENABLED', 'false') !== 'true') {
      this.logger.log('v2 wallet projector disabled (WALLET_PROJECTOR_V2_ENABLED=false)');
      return;
    }
    const consumer = new ReliableConsumer(this.bus, this.db);
    await consumer.start({
      subject: SUBJECT,
      durable: DURABLE,
      consumer: DURABLE,
      maxDeliver: intEnv('WALLET_PROJECTOR_MAX_DELIVER', 5),
      handler: async (envelope, client) => {
        await this.projection.applyV2(client, extractV2(envelope));
      },
    });
    this.logger.log('v2 wallet projector started (shadow; reads stay legacy)');
  }
}
