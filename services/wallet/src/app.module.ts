import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  NatsEventBus,
  NatsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { WalletController } from './api/wallet.controller';
import { WalletService } from './application/wallet.service';
import { WALLET_REPOSITORY } from './domain/ports';
import { PgWalletProjectionRepository } from './infra/db/pg-wallet-projection.repository';
import { PgWalletRepository } from './infra/db/pg-wallet.repository';
import { LedgerPostedV2Consumer } from './infra/events/ledger-posted-v2.consumer';
import { LedgerPostedConsumer } from './infra/events/ledger-posted.consumer';
import { WalletReconcileJob } from './infra/jobs/wallet-reconcile.job';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    PgWalletProjectionRepository,
    LedgerPostedConsumer,
    LedgerPostedV2Consumer,
    WalletReconcileJob,
    { provide: WALLET_REPOSITORY, useClass: PgWalletRepository },
  ],
})
export class AppModule {}
