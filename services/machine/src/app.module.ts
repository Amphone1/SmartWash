import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
  MqttBus,
  MqttModule,
  NatsEventBus,
  NatsModule,
  OutboxRelay,
} from '@smartwash/nestkit';
import { MachineController } from './api/machine.controller';
import { MachineService } from './application/machine.service';
import { MACHINE_REPOSITORY } from './domain/ports';
import { PgMachineRepository } from './infra/db/pg-machine.repository';
import { MachineMqttBridge } from './infra/mqtt/machine-mqtt.bridge';
import { MachineGateway } from './infra/ws/machine.gateway';

@Module({
  imports: [
    DatabaseModule,
    NatsModule,
    MqttModule,
    MetricsModule,
    HealthModule.forRoot([Database, NatsEventBus, MqttBus]),
  ],
  controllers: [MachineController],
  providers: [
    MachineService,
    MachineGateway,
    MachineMqttBridge,
    OutboxRelay, // publishes machine.* events (OUTBOX_AGGREGATE_TYPES=machine)
    { provide: MACHINE_REPOSITORY, useClass: PgMachineRepository },
  ],
})
export class AppModule {}
