/** Durable firehose consumer: every smartwash.> event → an audit_log row. */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@smartwash/nestkit';
import { mapEventToAudit } from '../../domain/mapping';
import { PgAuditRepository } from '../db/pg-audit.repository';

@Injectable()
export class AuditConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger('AuditConsumer');

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly repo: PgAuditRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe('smartwash.>', 'audit-firehose', async (envelope) => {
      const draft = mapEventToAudit(envelope as never);
      if (draft) await this.repo.append(draft);
    }, { maxDeliver: 5 });
    this.logger.log('audit firehose subscribed (smartwash.>)');
  }
}
