/**
 * Consumer inbox + DLQ + re-drive (EPIC A · A6). Makes event consumption
 * exactly-once and poison-safe — the reliable counterpart to the fire-and-forget
 * `EventBus.subscribe`. Closes finding H4 (LWW consumer dedup).
 *
 * - `consumeOnce`: insert (consumer,event_id) then run the handler in the SAME
 *   DB txn. A redelivery (PK conflict) is a no-op (dedup). Handler throw → the txn
 *   rolls back → the inbox row is not committed → the message is retried.
 * - `handleInboxDelivery`: per-delivery orchestration — dedup, retry on transient
 *   failure, and route to the DLQ once delivery attempts are exhausted (poison).
 * - `redrive`: republish a DLQ message back onto its original subject.
 * - `ReliableConsumer`: wires the above onto a NATS JetStream durable subscription.
 */
import { Logger } from '@nestjs/common';
import {
  consumerOpts,
  createInbox,
  JSONCodec,
  type JsMsg,
} from 'nats';
import { Counter } from 'prom-client';
import type { PoolClient } from 'pg';
import { registry } from '../metrics/metrics';
import type { Database } from '../db/pg';
import type { EventBus } from './nats';

// ── metrics ──────────────────────────────────────────────────────────────────
export const inboxProcessedTotal = new Counter({
  name: 'inbox_processed_total',
  help: 'Events processed exactly once via the inbox',
  labelNames: ['consumer'] as const,
  registers: [registry],
});
export const inboxDuplicateTotal = new Counter({
  name: 'inbox_duplicate_total',
  help: 'Duplicate events skipped by the inbox',
  labelNames: ['consumer'] as const,
  registers: [registry],
});
export const inboxRetryTotal = new Counter({
  name: 'inbox_retry_total',
  help: 'Transient handler failures retried',
  labelNames: ['consumer'] as const,
  registers: [registry],
});
export const dlqPublishedTotal = new Counter({
  name: 'dlq_published_total',
  help: 'Poison messages routed to a DLQ subject',
  labelNames: ['consumer'] as const,
  registers: [registry],
});
export const redriveTotal = new Counter({
  name: 'redrive_total',
  help: 'Messages re-driven from a DLQ back to the original subject',
  labelNames: ['subject'] as const,
  registers: [registry],
});

// ── primitives ───────────────────────────────────────────────────────────────

/**
 * Idempotent consume. Returns true if `process` ran (first time), false if the
 * event was already processed (dedup). MUST run on a transaction `client` so the
 * inbox row and the handler's side effects commit together (exactly-once).
 */
export async function consumeOnce(
  client: PoolClient,
  consumer: string,
  eventId: string,
  process: () => Promise<void>,
): Promise<boolean> {
  const res = await client.query(
    `INSERT INTO processed_events (consumer, event_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
    [consumer, eventId],
  );
  if (res.rowCount === 0) return false; // already processed → skip
  await process();
  return true;
}

export interface InboxMessage {
  eventId: string; // stable dedup key (NATS stream sequence)
  deliveryCount: number; // 1-based attempt number
  subject: string;
  payload: Record<string, unknown>;
}

export type InboxOutcome = 'ack' | 'retry' | 'dlq';

export interface InboxDeps {
  runInTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
  publishDlq(subject: string, payload: Record<string, unknown>): Promise<void>;
}

export function dlqSubjectFor(subject: string): string {
  return `${subject}.dlq`;
}
export function originalSubjectOf(dlqSubject: string): string {
  return dlqSubject.replace(/\.dlq$/, '');
}

/**
 * Decide and execute the outcome for one delivery. Pure of NATS — testable with
 * fakes. The caller acks (`ack`/`dlq`) or naks (`retry`) the broker message.
 */
export async function handleInboxDelivery(
  deps: InboxDeps,
  consumer: string,
  maxDeliver: number,
  handler: (payload: Record<string, unknown>) => Promise<void>,
  msg: InboxMessage,
): Promise<InboxOutcome> {
  try {
    const processed = await deps.runInTx((client) =>
      consumeOnce(client, consumer, msg.eventId, () => handler(msg.payload)),
    );
    if (processed) inboxProcessedTotal.inc({ consumer });
    else inboxDuplicateTotal.inc({ consumer });
    return 'ack';
  } catch (err) {
    if (msg.deliveryCount >= maxDeliver) {
      await deps.publishDlq(dlqSubjectFor(msg.subject), {
        originalSubject: msg.subject,
        eventId: msg.eventId,
        deliveryCount: msg.deliveryCount,
        error: err instanceof Error ? err.message : String(err),
        failedAt: new Date().toISOString(),
        payload: msg.payload,
      });
      dlqPublishedTotal.inc({ consumer });
      return 'dlq'; // poison: parked, never silently dropped (R1)
    }
    inboxRetryTotal.inc({ consumer });
    return 'retry';
  }
}

/** Republish one DLQ message back onto its original subject. */
export async function redrive(
  bus: Pick<EventBus, 'publish'>,
  dlqPayload: Record<string, unknown>,
): Promise<void> {
  const subject = String(dlqPayload.originalSubject ?? '');
  if (!subject) throw new Error('DLQ message missing originalSubject');
  const payload = (dlqPayload.payload ?? {}) as Record<string, unknown>;
  await bus.publish(subject, payload);
  redriveTotal.inc({ subject });
}

// ── NATS wiring ──────────────────────────────────────────────────────────────

export interface ReliableConsumerOptions {
  subject: string;
  durable: string;
  consumer: string; // inbox namespace (usually = durable)
  maxDeliver: number;
  handler: (payload: Record<string, unknown>) => Promise<void>;
}

/**
 * Durable JetStream subscription with inbox dedup + DLQ. The exactly-once and
 * poison logic lives in `handleInboxDelivery` (unit-tested); this is the thin
 * broker glue. Used by money-event consumers (e.g. the A7 wallet projector).
 */
export class ReliableConsumer {
  private readonly logger = new Logger('ReliableConsumer');
  private readonly codec = JSONCodec();

  constructor(
    private readonly bus: EventBus,
    private readonly db: Database,
  ) {}

  async start(opts: ReliableConsumerOptions): Promise<void> {
    const copts = consumerOpts();
    copts.durable(opts.durable);
    copts.manualAck();
    copts.ackExplicit();
    copts.deliverTo(createInbox());
    copts.maxDeliver(opts.maxDeliver);
    const sub = await this.bus.jetstream().subscribe(opts.subject, copts);

    const deps: InboxDeps = {
      runInTx: (fn) => this.db.withTransaction(fn),
      publishDlq: (subject, payload) => this.bus.publish(subject, payload),
    };

    void (async () => {
      for await (const m of sub) {
        const msg: InboxMessage = {
          eventId: String(m.seq), // stream sequence: stable across redeliveries
          deliveryCount: deliveryAttempt(m),
          subject: m.subject,
          payload: this.codec.decode(m.data) as Record<string, unknown>,
        };
        try {
          const outcome = await handleInboxDelivery(
            deps,
            opts.consumer,
            opts.maxDeliver,
            opts.handler,
            msg,
          );
          if (outcome === 'retry') m.nak();
          else m.ack(); // 'ack' or 'dlq' (parked) — done with this delivery
        } catch (err) {
          this.logger.error(`reliable consumer ${opts.consumer} error: ${String(err)}`);
          m.nak();
        }
      }
    })();
    this.logger.log(`reliable consumer ${opts.consumer} → ${opts.subject} (maxDeliver=${opts.maxDeliver})`);
  }
}

/** 1-based delivery attempt for a JetStream message. */
function deliveryAttempt(m: JsMsg): number {
  const c = m.info?.redeliveryCount;
  return typeof c === 'number' && c > 0 ? c : 1;
}
