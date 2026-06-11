import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  NatsEventBus,
  NatsModule,
} from '@smartwash/nestkit';
import { NotificationController } from './api/notification.controller';
import { EventConsumer } from './infra/events/event.consumer';
import { PgNotificationRepository } from './infra/db/pg-notification.repository';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [NotificationController],
  providers: [PgNotificationRepository, EventConsumer],
})
export class AppModule {}
