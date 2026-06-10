/**
 * One simulated WISE-4051 machine. Owns its MQTT connection (so it has its own
 * Last-Will), idles until it receives a START command, then walks the wash cycle
 * publishing status uplinks, and returns to IDLE.
 */
import mqtt, { type MqttClient } from 'mqtt';
import { buildCycle } from './cycle';
import { config, type SimDevice } from './config';

export class SimulatedDevice {
  private client?: MqttClient;
  private running = false;
  private state: 'IDLE' | 'STARTING' | 'RUNNING' | 'FINISHING' = 'IDLE';
  private progress = 0;
  private remaining = 0;
  private heartbeat?: NodeJS.Timeout;

  constructor(private readonly dev: SimDevice) {}

  private topic(kind: 'cmd' | 'status' | 'lwt'): string {
    return `smartwash/${this.dev.branchId}/${this.dev.code}/${kind}`;
  }

  start(): void {
    this.client = mqtt.connect(config.mqttUrl, {
      username: config.username,
      password: config.password,
      clientId: `sim-${this.dev.code}-${Math.random().toString(16).slice(2, 8)}`,
      will: {
        topic: this.topic('lwt'),
        payload: JSON.stringify({ machineId: this.dev.machineId, online: false }),
        qos: 1,
        retain: true,
      },
    });

    this.client.on('connect', () => {
      this.publishLwt(true);
      this.publishStatus();
      this.client!.subscribe(this.topic('cmd'), { qos: 2 });
      this.heartbeat = setInterval(() => this.publishStatus(), config.heartbeatMs);
    });

    this.client.on('message', (_t, payload) => {
      const cmd = safeJson(payload.toString());
      if (cmd?.cmd === 'START') void this.runCycle();
      if (cmd?.cmd === 'STOP') this.goIdle();
    });
  }

  private async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    for (const step of buildCycle(8, config.totalMinutes)) {
      if (!this.running) break;
      this.state = step.status;
      this.progress = step.progress;
      this.remaining = step.remaining;
      this.publishStatus();
      if (step.status !== 'IDLE') await sleep(config.stepMs);
    }
    this.running = false;
    this.goIdle();
  }

  private goIdle(): void {
    this.running = false;
    this.state = 'IDLE';
    this.progress = 0;
    this.remaining = 0;
    this.publishStatus();
  }

  private publishStatus(): void {
    this.client?.publish(
      this.topic('status'),
      JSON.stringify({
        machineId: this.dev.machineId,
        branchId: this.dev.branchId,
        status: this.state,
        progress: this.progress,
        remaining: this.remaining,
        ts: new Date().toISOString(),
      }),
      { qos: 1 },
    );
  }

  private publishLwt(online: boolean): void {
    this.client?.publish(
      this.topic('lwt'),
      JSON.stringify({ machineId: this.dev.machineId, online }),
      { qos: 1, retain: true },
    );
  }

  stop(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.publishLwt(false);
    this.client?.end();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function safeJson(text: string): { cmd?: string } | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
