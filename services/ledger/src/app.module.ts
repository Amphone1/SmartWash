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
import { ACCOUNT_RESOLVER, LEDGER_REPOSITORY, TRANSACTION_REPOSITORY } from './domain/ports';
import { DualWriteShim } from './application/dual-write.shim';
import { PgAccountRepository } from './infra/db/pg-account.repository';
import { PgLedgerRepository } from './infra/db/pg-ledger.repository';
import { PgTransactionRepository } from './infra/db/pg-transaction.repository';

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
    // A2: chart-of-accounts resolver. Registered now; wired into the posting
    // path by A3/A4.
    { provide: ACCOUNT_RESOLVER, useClass: PgAccountRepository },
    // A4: double-entry write path. Registered now; wired into live flows by A5.
    { provide: TRANSACTION_REPOSITORY, useClass: PgTransactionRepository },
    // A5: shadow dual-write shim (flag-gated, default off; injected by the legacy repo).
    DualWriteShim,
  ],
})
export class AppModule {}
