import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { ReconciliationController } from './api/reconciliation.controller';
import { ReconciliationService } from './application/reconciliation.service';
import { RECON_REPOSITORY } from './domain/ports';
import { PgReconciliationRepository } from './infra/db/pg-reconciliation.repository';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    { provide: RECON_REPOSITORY, useClass: PgReconciliationRepository },
  ],
})
export class AppModule {}
