import { Module } from '@nestjs/common';
import { HealthModule, MetricsModule } from '@smartwash/nestkit';
import { FraudController } from './api/fraud.controller';

@Module({
  imports: [MetricsModule, HealthModule.forRoot([])],
  controllers: [FraudController],
})
export class AppModule {}
