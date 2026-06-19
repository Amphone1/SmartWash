# A6 — Inbox + DLQ + re-drive (exactly-once consumption)

> EPIC A · increment **A6**. Implemented 2026-06-19 on branch `epic-a/a2-accounts`.
> Consume-side reliability for money events. No ledger write, no read cutover, no money
> movement. Preserves all ADRs, append-only, double-entry, idempotency, and A1–A5 behavior.
> Closes finding **H4** (LWW consumer dedup; no inbox/DLQ).

## Components
- **`processed_events`** (migration `10_inbox_dlq.sql`): `(consumer, event_id)` PK dedup
  table. Operational cache (prunable by `processed_at`), not append-only.
- **`consumeOnce(client, consumer, eventId, process)`** (`@smartwash/nestkit`): insert
  `(consumer,event_id)` ON CONFLICT DO NOTHING, then run `process` in the **same** txn.
  Redelivery → PK conflict → no-op (dedup). Handler throw → txn rollback → inbox row not
  committed → message retried. **Exactly-once** within the DB.
- **`handleInboxDelivery(deps, consumer, maxDeliver, handler, msg)`**: per-delivery
  orchestration — dedup, **retry** on transient failure (attempt < maxDeliver), **DLQ**
  on the final attempt (poison; parked on `{subject}.dlq`, never silently dropped → R1).
  NATS-free → unit-tested with fakes.
- **`redrive(bus, dlqPayload)`**: republish a DLQ message onto its original subject.
- **`ReliableConsumer`**: thin JetStream durable-subscription glue that builds an
  `InboxMessage` (eventId = **stream sequence**, stable across redeliveries) and
  acks/naks/DLQs per the orchestrator. The A7 wallet projector will consume through this.

## Dedup key
`event_id = NATS stream sequence` (`m.seq`) — stable for the life of a stored message, so
redeliveries and durable replays dedup correctly. Broker-level publish dedup is already
provided by the relay's `msgID = outbox row id`. Together: at-least-once delivery →
exactly-once apply.

## Why a new path (not a change to `EventBus.subscribe`)
Existing consumers (audit/notification/wallet) use the fire-and-forget `subscribe` and must
keep working (preserve A1–A5). `ReliableConsumer` is additive; consumers migrate onto it
deliberately (the A7 projector first).

## Invariants preserved
- Append-only / double-entry / chart of accounts: untouched (A6 writes only `processed_events`).
- Idempotency & replay: strengthened (exactly-once consume).
- Legacy authoritative; dual-write flags still default OFF.

## Metrics & alerting
`inbox_processed_total{consumer}`, `inbox_duplicate_total`, `inbox_retry_total`,
`dlq_published_total{consumer}`, `redrive_total{subject}`. A DLQ-growth alert is recommended
when the first consumer is wired (A7) — the rules file can extend
`infra/observability/alerts/`.

## Verification
- Unit (`inbox.spec.ts`): consumeOnce dedup; handleInboxDelivery ack/duplicate/retry/DLQ;
  redrive; subject helpers.
- DB (`tests/10_inbox_dlq.verify.sql`, CI-wired): PK dedup, per-consumer isolation, default.
- No live consumer is rewired here (that is A7).
