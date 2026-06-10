import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  RbacModule,
} from '@smartwash/nestkit';
import { GpsController } from './api/gps.controller';
import { GpsService } from './application/gps.service';
import { GPS_REPOSITORY } from './domain/ports';
import { PgGpsRepository } from './infra/db/pg-gps.repository';
import { GpsGateway } from './infra/ws/gps.gateway';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [GpsController],
  providers: [
    GpsService,
    GpsGateway,
    { provide: GPS_REPOSITORY, useClass: PgGpsRepository },
  ],
})
export class AppModule {}
