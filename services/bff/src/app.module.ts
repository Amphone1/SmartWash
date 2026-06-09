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
  OrderClient,
  QueueClient,
  RbacClient,
} from './infra/external/clients';
import { CatalogRepository } from './infra/db/catalog.repository';
import { BffAuthGuard } from './api/auth.guard';
import { PermissionsGuard } from './api/permissions.guard';
import { CatalogController } from './api/catalog.controller';
import { OrdersController } from './api/orders.controller';
import { QueueController } from './api/queue.controller';

@Module({
  imports: [DatabaseModule, MetricsModule, HealthModule.forRoot([Database])],
  controllers: [CatalogController, OrdersController, QueueController],
  providers: [
    ServicesConfig,
    AuthClient,
    RbacClient,
    OrderClient,
    QueueClient,
    CatalogRepository,
    BffAuthGuard,
    PermissionsGuard,
  ],
})
export class AppModule {}
