import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { LedgerController } from './api/ledger.controller';
import { LedgerService } from './application/ledger.service';
import { LEDGER_REPOSITORY } from './domain/ports';
import { PgLedgerRepository } from './infra/db/pg-ledger.repository';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [LedgerController],
  providers: [
    LedgerService,
    { provide: LEDGER_REPOSITORY, useClass: PgLedgerRepository },
  ],
})
export class AppModule {}
