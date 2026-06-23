# A6_READINESS_REVIEW.md — readiness to start increment A6

> Assesses whether EPIC A increment **A6** is ready to start, given A1–A5 are complete.
> Generated 2026-06-19. **Read-only — no source changed.** Decision only; A6 is STOP-and-ask.

## What A6 is (from `REMEDIATION_PLAN.md`)
> *Inbox + DLQ (`processed_events`, `*.dlq`, re-drive).* Live money? **❌ infra.** Gate to
> advance: **dedup + poison tests.**

A6 is **consume-side reliability** for the new money events. It adds an **inbox**
(`processed_events(consumer, event_id)`) so a consumer dedups on the Envelope `id` and
processes exactly once, a **DLQ** (`{subject}.dlq`) so a poison message is parked (never
silently dropped — invariant R1), and a **re-drive** path. It writes **no** ledger and moves
**no** money — it is the safety substrate the A7 wallet projector consumes through. Closes the
open finding **H4** (consumer dedup is LWW; no inbox/DLQ).

## A6 prerequisites checklist
| # | Prerequisite | State | Evidence |
|---|---|---|---|
| 1 | `posted.v2` emitted to the outbox | ✅ | A4/A5 `pg-transaction.repository.ts` / shim |
| 2 | Outbox relay → NATS JetStream | ✅ | `@smartwash/nestkit` `OutboxRelay` / `NatsModule` / `EventBus` |
| 3 | Event Envelope with a stable `id` to dedup on | ✅ | `contracts/events/events.schema.json` |
| 4 | Atomic-txn primitive for check-insert-process | ✅ | `Database.withTransaction` |
| 5 | A first real consumer to wire through | ✅ (target) | the A7 wallet projector (built next) |

Prereqs **met.** A6 design decisions to settle in its plan:

| # | A6 design item |
|---|---|
| D1 | **`processed_events` schema + migration** — `(consumer TEXT, event_id UUID, processed_at)` PK `(consumer,event_id)`. **New migration `10_*`** → STOP-and-ask, append-only-friendly. |
| D2 | **Inbox helper in `nestkit`** — `consumeOnce(client, consumer, eventId, fn)`: insert the inbox row (ON CONFLICT DO NOTHING); if already present, skip; else run `fn` in the same txn. Idempotent consume. |
| D3 | **DLQ policy** — bounded retries (NAK/backoff) → publish to `{subject}.dlq`; never ack-drop. A `re-drive` tool/endpoint replays DLQ → original subject. |
| D4 | **Consumer wiring** — wrap the `EventBus`/NATS subscription so every money-event consumer goes through the inbox + DLQ; start with the A7 projector. |
| D5 | **Poison-message handling** — deterministic failure detection (max-deliver) vs transient; metrics (`inbox_dedup_total`, `dlq_total`, `redrive_total`) + alert on DLQ growth. |

## A6 scope guardrails
- Reliability infra only — **no** ledger write, **no** read cutover, **no** money movement.
- Preserve ADRs, append-only, double-entry, idempotency, the chart of accounts, reconciliation.
- The new migration (`processed_events`) is **additive** and reviewed by hand.
- Do **not** start A7 (wallet projection) beyond wiring the inbox as its substrate; A8 cutover and
  EPIC C remain out.

## GO / NO-GO recommendation for A6
**🟢 GO to start A6 (design-first).** All prerequisites are in place; A6 is **lower risk than
A5** (no live-money write, additive infra). Recommended next step: an **A6 implementation plan**
(the `processed_events` migration, the `nestkit` inbox helper, DLQ + re-drive policy, consumer
wiring, and the dedup/poison test matrix) for review before code — per the money STOP-and-ask
rule. The `10_*` migration is reviewed by hand.

**Carry-over (unchanged):** A5 is **not prod-enabled** — production dual-write enablement (with
the backfill caveat in `A5_COMPLETION_REPORT.md` §7 and the staging zero-drift gate) is a
separate future step and is **not** a prerequisite for building A6/A7. Open findings in
`A1_A2_COMPLETION_REPORT.md` §6–§7 and the A3 VAT-rounding sign-off remain tracked.
