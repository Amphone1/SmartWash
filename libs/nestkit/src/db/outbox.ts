/**
 * Outbox helper (rule #4). Call within the SAME transaction as the domain write
 * so the event and the state change commit together. A separate relay
 * (OutboxRelay) later publishes PENDING rows to NATS and marks them PUBLISHED.
 */
import type { PoolClient } from 'pg';
import { getCorrelationId } from '../correlation/correlation';

export interface OutboxMessage {
  aggregateType: string; // order | machine | payment | ...
  aggregateId: string; // UUID
  eventType: string; // e.g. smartwash.order.created.v1
  payload: Record<string, unknown>;
}

/**
 * Insert one outbox row. Must be passed the same `client` running the domain
 * transaction. The correlation id is folded into the payload envelope so the
 * relay can propagate it onto the NATS message.
 */
export async function insertOutbox(
  client: PoolClient,
  msg: OutboxMessage,
): Promise<void> {
  const envelopedPayload = {
    ...msg.payload,
    correlationId: getCorrelationId() ?? null,
  };
  await client.query(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
    [msg.aggregateType, msg.aggregateId, msg.eventType, envelopedPayload],
  );
}
