import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  IdempotencyService,
  MetricsModule,
} from '@smartwash/nestkit';
import { QueueController } from './api/queue.controller';
import { QueueService } from './application/queue.service';
import { QUEUE_REPOSITORY } from './domain/ports';
import { PgQueueRepository } from './infra/db/pg-queue.repository';

@Module({
  imports: [DatabaseModule, MetricsModule, HealthModule.forRoot([Database])],
  controllers: [QueueController],
  providers: [
    QueueService,
    IdempotencyService,
    { provide: QUEUE_REPOSITORY, useClass: PgQueueRepository },
  ],
})
export class AppModule {}
