/**
 * Consumes LedgerPosted events from NATS JetStream and updates the wallet cache.
 * Durable, idempotent (last-write-wins on balance_after). The relay publishes an
 * Envelope, so the LedgerPosted payload is under `data`.
 */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@smartwash/nestkit';
import { WalletService } from '../../application/wallet.service';
import type { LedgerPosted } from '../../domain/ports';

const SUBJECT = 'smartwash.ledger.posted.v1';
const DURABLE = 'wallet-ledger-posted';

@Injectable()
export class LedgerPostedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger('LedgerPostedConsumer');

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly wallet: WalletService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe(SUBJECT, DURABLE, async (envelope) => {
      const data = (envelope.data ?? envelope) as LedgerPosted;
      await this.wallet.onLedgerPosted(data);
      this.logger.debug(`applied ledger ${data.ledgerId} for user ${data.userId}`);
    });
  }
}
