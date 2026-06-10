import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { SettlementController } from './api/settlement.controller';
import { SettlementService } from './application/settlement.service';
import { SETTLEMENT_REPOSITORY } from './domain/ports';
import { PgSettlementRepository } from './infra/db/pg-settlement.repository';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    { provide: SETTLEMENT_REPOSITORY, useClass: PgSettlementRepository },
  ],
})
export class AppModule {}
