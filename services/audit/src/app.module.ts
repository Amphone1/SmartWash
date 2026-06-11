import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  NatsEventBus,
  NatsModule,
} from '@smartwash/nestkit';
import { AuditController } from './api/audit.controller';
import { AuditConsumer } from './infra/events/audit.consumer';
import { PgAuditRepository } from './infra/db/pg-audit.repository';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [AuditController],
  providers: [PgAuditRepository, AuditConsumer],
})
export class AppModule {}
