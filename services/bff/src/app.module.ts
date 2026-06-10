import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  RateLimitGuard,
  RedisModule,
} from '@smartwash/nestkit';
import { ServicesConfig } from './config/services.config';
import {
  AuthClient,
  DeliveryClient,
  GpsClient,
  OrderClient,
  PaymentClient,
  QueueClient,
  RbacClient,
  ReconciliationClient,
  SettlementClient,
  WalletClient,
} from './infra/external/clients';
import { CatalogRepository } from './infra/db/catalog.repository';
import { ReportingRepository } from './infra/db/reporting.repository';
import { BffAuthGuard } from './api/auth.guard';
import { PermissionsGuard } from './api/permissions.guard';
import { CatalogController } from './api/catalog.controller';
import { OrdersController } from './api/orders.controller';
import { QueueController } from './api/queue.controller';
import { TopupController } from './api/topup.controller';
import { DriverController } from './api/driver.controller';
import { DeliveryTrackController } from './api/delivery-track.controller';
import { ReportingController } from './api/reporting.controller';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [
    CatalogController,
    OrdersController,
    QueueController,
    TopupController,
    DriverController,
    DeliveryTrackController,
    ReportingController,
  ],
  providers: [
    ServicesConfig,
    AuthClient,
    RbacClient,
    OrderClient,
    QueueClient,
    PaymentClient,
    WalletClient,
    DeliveryClient,
    GpsClient,
    SettlementClient,
    ReconciliationClient,
    CatalogRepository,
    ReportingRepository,
    BffAuthGuard,
    PermissionsGuard,
    RateLimitGuard,
  ],
})
export class AppModule {}
