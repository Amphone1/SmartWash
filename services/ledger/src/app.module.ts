import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  NatsEventBus,
  NatsModule,
  OutboxRelay,
  RbacModule,
} from '@smartwash/nestkit';
import { LedgerController } from './api/ledger.controller';
import { LedgerService } from './application/ledger.service';
import { LEDGER_REPOSITORY } from './domain/ports';
import { PgLedgerRepository } from './infra/db/pg-ledger.repository';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [LedgerController],
  providers: [
    LedgerService,
    OutboxRelay, // publishes ledger.* events (OUTBOX_AGGREGATE_TYPES=ledger)
    { provide: LEDGER_REPOSITORY, useClass: PgLedgerRepository },
  ],
})
export class AppModule {}
