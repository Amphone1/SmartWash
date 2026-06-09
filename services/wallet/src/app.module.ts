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
import { PgWalletRepository } from './infra/db/pg-wallet.repository';
import { LedgerPostedConsumer } from './infra/events/ledger-posted.consumer';

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
    LedgerPostedConsumer,
    { provide: WALLET_REPOSITORY, useClass: PgWalletRepository },
  ],
})
export class AppModule {}
