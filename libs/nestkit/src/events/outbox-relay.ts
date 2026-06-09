/**
 * Outbox relay (rule #4 second half). Polls `outbox` for PENDING rows, wraps each
 * in the standard event Envelope, publishes to NATS JetStream on a subject equal
 * to the event type, then marks the row PUBLISHED. Failures mark FAILED for retry.
 *
 * At-least-once delivery: the JetStream message id is the outbox row id, so a
 * re-published row is deduplicated by the broker, and consumers must be
 * idempotent anyway.
 */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../db/pg';
import { intEnv, optionalEnv } from '../config/env';
import { EVENT_BUS, type EventBus } from './nats';

interface OutboxRow {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OutboxRelay');
  private readonly serviceName = optionalEnv('SERVICE_NAME', 'unknown');
  private readonly batchSize = intEnv('OUTBOX_BATCH_SIZE', 100);
  private readonly intervalMs = intEnv('OUTBOX_POLL_MS', 1000);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly db: Database,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    if (optionalEnv('OUTBOX_RELAY_ENABLED', 'true') !== 'true') return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.logger.log(`outbox relay started (every ${this.intervalMs}ms)`);
  }

  /** One poll cycle, guarded against overlap. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.relayBatch();
    } catch (err) {
      this.logger.error(`relay batch failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async relayBatch(): Promise<number> {
    const { rows } = await this.db.getPool().query<OutboxRow>(
      `SELECT id, aggregate_type, aggregate_id, event_type, payload
         FROM outbox WHERE state = 'PENDING'
         ORDER BY created_at ASC LIMIT $1`,
      [this.batchSize],
    );

    let published = 0;
    for (const row of rows) {
      try {
        const correlationId =
          typeof row.payload.correlationId === 'string'
            ? row.payload.correlationId
            : undefined;
        const envelope = {
          id: randomUUID(),
          type: row.event_type,
          source: this.serviceName,
          time: new Date().toISOString(),
          correlationId: correlationId ?? null,
          data: row.payload,
        };
        await this.bus.publish(row.event_type, envelope, {
          dedupId: row.id,
          correlationId,
        });
        await this.db
          .getPool()
          .query(
            `UPDATE outbox SET state = 'PUBLISHED', published_at = now() WHERE id = $1`,
            [row.id],
          );
        published += 1;
      } catch (err) {
        this.logger.error(`failed to publish outbox ${row.id}: ${String(err)}`);
        await this.db
          .getPool()
          .query(`UPDATE outbox SET state = 'FAILED' WHERE id = $1`, [row.id]);
      }
    }
    return published;
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
