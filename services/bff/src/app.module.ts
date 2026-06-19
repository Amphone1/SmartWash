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
  AddressesClient,
  AuditClient,
  AuthClient,
  DeliveryClient,
  GpsClient,
  NotificationClient,
  OrderClient,
  PaymentClient,
  QueueClient,
  RatingsClient,
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
import { AddressesController } from './api/addresses.controller';
import { StaffController } from './api/staff.controller';

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
    AddressesController,
    StaffController,
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
    NotificationClient,
    AuditClient,
    CatalogRepository,
    ReportingRepository,
    RatingsClient,
    AddressesClient,
    BffAuthGuard,
    PermissionsGuard,
    RateLimitGuard,
  ],
})
export class AppModule {}
