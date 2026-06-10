import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  IdempotencyService,
  MetricsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { PaymentController } from './api/payment.controller';
import { PaymentService } from './application/payment.service';
import { PAYMENT_REPOSITORY } from './domain/ports';
import { PgPaymentRepository } from './infra/db/pg-payment.repository';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    IdempotencyService,
    { provide: PAYMENT_REPOSITORY, useClass: PgPaymentRepository },
  ],
})
export class AppModule {}
