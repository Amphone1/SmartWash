import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  IdempotencyService,
  MetricsModule,
  NatsEventBus,
  NatsModule,
  OutboxRelay,
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
    NatsModule,
    MetricsModule,
    HealthModule.forRoot([Database, RedisLock, NatsEventBus]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    IdempotencyService,
    OutboxRelay, // publishes order.* events (OUTBOX_AGGREGATE_TYPES=order)
    { provide: MACHINE_LOOKUP, useClass: PgMachineLookup },
    { provide: ORDER_REPOSITORY, useClass: PgOrderRepository },
  ],
})
export class AppModule {}
