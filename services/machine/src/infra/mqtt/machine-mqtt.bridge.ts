/**
 * Subscribes to WISE-4051 status + lwt topics and feeds them to MachineService.
 * Also runs the heartbeat sweep that flips silent machines to OFFLINE.
 */
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { MqttBus, intEnv } from '@smartwash/nestkit';
import { MachineService } from '../../application/machine.service';

@Injectable()
export class MachineMqttBridge implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('MachineMqttBridge');
  private readonly timeoutSec = intEnv('HEARTBEAT_TIMEOUT_SEC', 30);
  private readonly checkMs = intEnv('HEARTBEAT_CHECK_MS', 10_000);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly mqtt: MqttBus,
    private readonly machine: MachineService,
  ) {}

  onApplicationBootstrap(): void {
    this.mqtt.subscribe(
      'smartwash/+/+/status',
      (_t, payload) => this.machine.onStatus(payload as never),
      1,
    );
    this.mqtt.subscribe(
      'smartwash/+/+/lwt',
      (_t, payload) => this.machine.onLwt(payload as never),
      1,
    );
    this.timer = setInterval(() => {
      void this.machine
        .sweepStale(this.timeoutSec)
        .catch((e) => this.logger.error(`sweep failed: ${String(e)}`));
    }, this.checkMs);
    this.logger.log('MQTT bridge subscribed; heartbeat sweep running');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
