import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  IdempotencyService,
  MetricsModule,
  RedisLock,
  RedisModule,
} from '@smartwash/nestkit';
import { OrdersController } from './api/orders.controller';
import { OrdersService } from './application/orders.service';
import { MACHINE_LOOKUP, ORDER_REPOSITORY } from './domain/ports';
import { PgMachineLookup } from './infra/db/pg-machine.lookup';
import { PgOrderRepository } from './infra/db/pg-order.repository';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MetricsModule,
    HealthModule.forRoot([Database, RedisLock]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    IdempotencyService,
    { provide: MACHINE_LOOKUP, useClass: PgMachineLookup },
    { provide: ORDER_REPOSITORY, useClass: PgOrderRepository },
  ],
})
export class AppModule {}
