/** Durable NATS consumers feeding the event→notification mapping. */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@smartwash/nestkit';
import { mapEvent, SUBSCRIBED_SUBJECTS } from '../../domain/mapping';
import { PgNotificationRepository } from '../db/pg-notification.repository';

@Injectable()
export class EventConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger('NotificationConsumer');

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly repo: PgNotificationRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const subject of SUBSCRIBED_SUBJECTS) {
      const durable = `notification-${subject.replace(/\./g, '-')}`;
      await this.bus.subscribe(subject, durable, async (envelope) => {
        const draft = mapEvent(envelope as never);
        if (draft) {
          await this.repo.record(draft);
          this.logger.debug(`queued ${draft.type} for ${draft.userId}`);
        }
      });
    }
  }
}
