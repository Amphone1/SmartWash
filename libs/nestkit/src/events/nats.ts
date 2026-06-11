/**
 * NATS JetStream event bus. Publishes domain events (from the outbox relay) onto
 * a durable stream so consumers (e.g. wallet) can process them reliably and
 * idempotently. Subjects follow the event type, e.g. `smartwash.ledger.posted.v1`.
 */
import {
  Global,
  Injectable,
  Logger,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  connect,
  consumerOpts,
  createInbox,
  JSONCodec,
  headers as natsHeaders,
  type JetStreamClient,
  type NatsConnection,
} from 'nats';
import { optionalEnv } from '../config/env';
import type { ReadinessCheck } from '../health/health';

export const EVENT_BUS = Symbol('EVENT_BUS');

/** Stream that captures every SmartWash domain event. */
export const STREAM_NAME = 'SMARTWASH';
export const STREAM_SUBJECTS = ['smartwash.>'];

export interface PublishOptions {
  /** Stable id for JetStream message dedup (e.g. the outbox row id). */
  dedupId?: string;
  correlationId?: string;
}

export interface SubscribeOptions {
  /** Max total delivery attempts before JetStream stops retrying (default: unlimited). */
  maxDeliver?: number;
}

export interface EventBus {
  publish(
    subject: string,
    payload: Record<string, unknown>,
    opts?: PublishOptions,
  ): Promise<void>;
  /** Durable push subscription; handler runs per message, acked on success. */
  subscribe(
    subject: string,
    durable: string,
    handler: (payload: Record<string, unknown>) => Promise<void>,
    opts?: SubscribeOptions,
  ): Promise<void>;
  jetstream(): JetStreamClient;
}

@Injectable()
export class NatsEventBus
  implements EventBus, ReadinessCheck, OnModuleInit, OnModuleDestroy
{
  readonly name = 'nats';
  private readonly logger = new Logger('NatsEventBus');
  private readonly codec = JSONCodec();
  private connection?: NatsConnection;
  private js?: JetStreamClient;

  async onModuleInit(): Promise<void> {
    const url = optionalEnv('NATS_URL', 'nats://localhost:4222');
    this.connection = await connect({ servers: url });
    this.js = this.connection.jetstream();

    // Ensure the stream exists (idempotent).
    const jsm = await this.connection.jetstreamManager();
    try {
      await jsm.streams.add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS });
    } catch {
      await jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS });
    }
    this.logger.log(`connected to NATS at ${url}, stream ${STREAM_NAME} ready`);
  }

  jetstream(): JetStreamClient {
    if (!this.js) throw new Error('NATS not connected');
    return this.js;
  }

  async publish(
    subject: string,
    payload: Record<string, unknown>,
    opts: PublishOptions = {},
  ): Promise<void> {
    const h = natsHeaders();
    if (opts.correlationId) h.set('correlation-id', opts.correlationId);
    await this.jetstream().publish(subject, this.codec.encode(payload), {
      headers: h,
      msgID: opts.dedupId,
    });
  }

  async subscribe(
    subject: string,
    durable: string,
    handler: (payload: Record<string, unknown>) => Promise<void>,
    opts: SubscribeOptions = {},
  ): Promise<void> {
    const copts = consumerOpts();
    copts.durable(durable);
    copts.manualAck();
    copts.ackExplicit();
    copts.deliverTo(createInbox());
    if (opts.maxDeliver !== undefined) copts.maxDeliver(opts.maxDeliver);
    const sub = await this.jetstream().subscribe(subject, copts);
    void (async () => {
      for await (const m of sub) {
        try {
          await handler(
            this.codec.decode(m.data) as Record<string, unknown>,
          );
          m.ack();
        } catch (err) {
          this.logger.error(`consumer ${durable} failed: ${String(err)}`);
          m.nak();
        }
      }
    })();
    this.logger.log(`subscribed ${durable} → ${subject}`);
  }

  async check(): Promise<boolean> {
    return !!this.connection && !this.connection.isClosed();
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.drain();
  }
}

@Global()
@Module({
  providers: [
    NatsEventBus,
    { provide: EVENT_BUS, useExisting: NatsEventBus },
  ],
  exports: [NatsEventBus, EVENT_BUS],
})
export class NatsModule {}
