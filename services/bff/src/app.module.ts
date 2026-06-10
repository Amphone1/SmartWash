import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
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
  WalletClient,
} from './infra/external/clients';
import { CatalogRepository } from './infra/db/catalog.repository';
import { BffAuthGuard } from './api/auth.guard';
import { PermissionsGuard } from './api/permissions.guard';
import { CatalogController } from './api/catalog.controller';
import { OrdersController } from './api/orders.controller';
import { QueueController } from './api/queue.controller';
import { TopupController } from './api/topup.controller';
import { DriverController } from './api/driver.controller';
import { DeliveryTrackController } from './api/delivery-track.controller';

@Module({
  imports: [DatabaseModule, MetricsModule, HealthModule.forRoot([Database])],
  controllers: [
    CatalogController,
    OrdersController,
    QueueController,
    TopupController,
    DriverController,
    DeliveryTrackController,
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
    CatalogRepository,
    BffAuthGuard,
    PermissionsGuard,
  ],
})
export class AppModule {}
