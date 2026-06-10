/**
 * MQTT access (EMQX). Thin wrapper over `mqtt` that connects on module init,
 * dispatches incoming messages to registered topic-filter handlers (with MQTT
 * wildcard matching), and publishes JSON payloads at a chosen QoS.
 *
 * WISE-4051 topic plan: smartwash/{branch}/{machine}/{cmd|status|lwt}
 *   cmd    QoS 2 (downlink)
 *   status QoS 1 (uplink)
 *   lwt    QoS 1 retained (broker publishes on disconnect)
 */
import {
  Global,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import mqtt, { type MqttClient } from 'mqtt';
import { optionalEnv } from '../config/env';
import type { ReadinessCheck } from '../health/health';

export type Qos = 0 | 1 | 2;

interface Subscription {
  filter: string;
  regex: RegExp;
  handler: (topic: string, payload: Record<string, unknown>) => void | Promise<void>;
}

/** Convert an MQTT topic filter to a RegExp (`+` one level, `#` rest). */
export function filterToRegex(filter: string): RegExp {
  const escaped = filter
    .split('/')
    .map((seg) => {
      if (seg === '+') return '[^/]+';
      if (seg === '#') return '.*';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped}$`);
}

@Injectable()
export class MqttBus implements OnModuleInit, OnModuleDestroy, ReadinessCheck {
  readonly name = 'mqtt';
  private readonly logger = new Logger('MqttBus');
  private client?: MqttClient;
  private readonly subs: Subscription[] = [];

  onModuleInit(): void {
    const url = optionalEnv('MQTT_URL', 'mqtt://localhost:1883');
    this.client = mqtt.connect(url, {
      username: optionalEnv('MQTT_USERNAME', 'backend'),
      password: optionalEnv('MQTT_PASSWORD', ''),
      reconnectPeriod: 2000,
    });
    this.client.on('connect', () => this.logger.log(`connected to MQTT ${url}`));
    this.client.on('error', (err) => this.logger.error(`mqtt error: ${String(err)}`));
    this.client.on('message', (topic, payload) => void this.dispatch(topic, payload));
  }

  private async dispatch(topic: string, payload: Buffer): Promise<void> {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(payload.toString() || '{}');
    } catch {
      this.logger.warn(`non-JSON payload on ${topic}`);
      return;
    }
    for (const s of this.subs) {
      if (s.regex.test(topic)) {
        try {
          await s.handler(topic, parsed);
        } catch (err) {
          this.logger.error(`handler for ${s.filter} failed: ${String(err)}`);
        }
      }
    }
  }

  subscribe(
    filter: string,
    handler: Subscription['handler'],
    qos: Qos = 1,
  ): void {
    this.subs.push({ filter, regex: filterToRegex(filter), handler });
    this.client?.subscribe(filter, { qos });
  }

  publish(topic: string, payload: Record<string, unknown>, qos: Qos = 1): void {
    this.client?.publish(topic, JSON.stringify(payload), { qos });
  }

  check(): boolean {
    return this.client?.connected ?? false;
  }

  onModuleDestroy(): void {
    this.client?.end();
  }
}

@Global()
@Module({
  providers: [MqttBus],
  exports: [MqttBus],
})
export class MqttModule {}
