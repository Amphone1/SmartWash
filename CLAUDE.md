# CLAUDE.md — SmartWash v5

> Read this fully before any work. It is the project constitution. The detailed
> spec lives at the repo root; this file is the always-loaded summary + guardrails.

## What this is
Multi-branch self-service + pickup/delivery laundry platform for Laos.
No Bank API: payment = Owner QR → slip upload → OCR + Fraud + Risk → Ledger TOPUP,
reconciled daily against the owner's bank statement. Wallet = the Ledger balance.
Machines run on WISE-4051 over MQTT.

## Read order (do this first, every session)
1. `BUILD_PLAN.md` — structure, stack, phases
2. `infra/db/init/01_schema.sql` — the database (source of truth)
3. `contracts/openapi/*.yaml` — REST contracts
4. `contracts/events/events.schema.json` — event envelope + payloads
5. `contracts/mqtt/mqtt.schema.json` — WISE-4051 cmd/status/lwt
6. `docs/saga/wash_order.md` — saga forward + compensation

## 10 non-negotiable rules
1. Money is BIGINT in **kip**. Never floats for money, anywhere.
2. `ledger_entries` is **append-only**. Never UPDATE/DELETE — corrections are new
   `ADJUSTMENT` / `REFUND_REVERSAL` rows.
3. Every state-changing POST requires an `Idempotency-Key` header (UUID v4),
   persisted in `idempotency_keys`.
4. **Outbox pattern:** write the domain row + an `outbox` row in the same DB
   transaction; a relay publishes to NATS. No direct cross-service writes.
5. Sagas via **Temporal**. The `wash_order` saga owns reserve→pay→start→finish
   with compensation. No ad-hoc orchestration.
6. **Redis SETNX + TTL (15m)** for machine reservation locks.
7. **OpenTelemetry everywhere** — propagate `correlation-id` across every hop.
8. RBAC enforced at the gateway AND re-checked in services.
9. `slips.slip_hash` (SHA-256) is UNIQUE — DB-level fraud dedup.
10. **Machine FSM ≠ Order FSM.** Sync only through events; never bake payment
    state into the device state machine.

## Build discipline
- **One phase per PR.** Do not build multiple phases at once.
- Start with **Phase 0** (scaffold + infra compose + schema migration). Stop when
  `docker compose up` works, migration passes, health endpoints respond.
- Do NOT advance to the next phase until I review and approve.
- Phase order: 0 Foundation → 1 Identity+Core → 2 Payment chain (Topup E2E) →
  3 Machine+IoT (dual-FSM saga) → 4 Delivery → 5 Finance+Portals → 6 Hardening.
- Build the **financial spine first** in Phase 2: payment + ledger + order, with
  the Topup flow working end-to-end before anything else.

## STOP and ask me — do not auto-implement these without review
- `ledger` service write paths (TOPUP/DEDUCT/REVERSAL math)
- `payment` slip → OCR → fraud → approve decision logic
- `saga` compensation steps (refund correctness)
- Database **migrations** (review every one by hand)
- Auth / RBAC / security logic
- CI/CD and deploy config
These touch money or security — propose a diff and wait. Treat your terminal
commands like a junior dev running things on my machine.

## Stack quick ref
Nx monorepo · NestJS (TS) services · FastAPI (OCR/Risk) · React Native (apps) ·
React+Vite (portals) · Postgres+TimescaleDB · Redis · NATS JetStream · Temporal ·
EMQX (MQTT) · MinIO · Keycloak · Prometheus/Grafana/Loki/Tempo/Alertmanager.

## Per-service shape (NestJS, hexagonal)
`src/{api,domain,application,infra/{db,events,external},config,health}` +
`/health/live` `/health/ready` `/metrics` + OTel + unit & Testcontainers tests +
Dockerfile. OCR/Risk are FastAPI equivalents.

## Dev commands

```bash
# bring up infra dependencies
docker compose -f infra/docker/docker-compose.dev.yml up -d
# (schema auto-loads from infra/db/init/01_schema.sql)
npx nx run-many -t lint
npx nx run-many -t test
```

## Current phase
> **PHASE 1** — Identity + Core (Auth/Keycloak, RBAC, Order, Queue, BFF/Traefik,
> minimal Customer app). Phase 0 foundation complete and approved.
