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
  RbacModule,
} from '@smartwash/nestkit';
import { PaymentController } from './api/payment.controller';
import { PaymentService } from './application/payment.service';
import { PAYMENT_REPOSITORY } from './domain/ports';
import { PgPaymentRepository } from './infra/db/pg-payment.repository';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    IdempotencyService,
    OutboxRelay, // publishes payment.* events (OUTBOX_AGGREGATE_TYPES=payment)
    { provide: PAYMENT_REPOSITORY, useClass: PgPaymentRepository },
  ],
})
export class AppModule {}
