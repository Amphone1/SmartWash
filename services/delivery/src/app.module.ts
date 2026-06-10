import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  NatsEventBus,
  NatsModule,
  OutboxRelay,
  RbacModule,
} from '@smartwash/nestkit';
import { DeliveryController } from './api/delivery.controller';
import { DeliveryService } from './application/delivery.service';
import {
  DELIVERY_REPOSITORY,
  DISTANCE_PROVIDER,
  DRIVER_REPOSITORY,
} from './domain/ports';
import { PgDeliveryRepository } from './infra/db/pg-delivery.repository';
import { PgDriverRepository } from './infra/db/pg-driver.repository';
import { GoogleMapsClient } from './infra/external/maps.client';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    OutboxRelay, // publishes delivery.* events (OUTBOX_AGGREGATE_TYPES=delivery)
    { provide: DELIVERY_REPOSITORY, useClass: PgDeliveryRepository },
    { provide: DRIVER_REPOSITORY, useClass: PgDriverRepository },
    { provide: DISTANCE_PROVIDER, useClass: GoogleMapsClient },
  ],
})
export class AppModule {}
