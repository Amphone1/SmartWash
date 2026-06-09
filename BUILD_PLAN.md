# SmartWash v5 Enterprise — Build Plan

> Hand this document to the coding agent. It is the single source of truth for
> structure, stack, conventions, and build order. Architecture diagrams, FSMs,
> ERDs, the SQL schema, and the service matrix are companion artifacts.

---

## 1. Product summary

SmartWash is a multi-branch self-service + pickup/delivery laundry platform for
Laos. Core constraints:

- **No Bank API.** Payment = Owner QR (bank transfer outside the system) → user
  uploads a slip → OCR + Fraud + Risk verify it → Ledger TOPUP. Daily
  reconciliation against the owner's bank statement is mandatory.
- **Wallet = Ledger.** Users top up once (the QR/slip chain), then spend with an
  instant `DEDUCT`. `ledger_entries` is append-only; `wallets.balance` is a cache.
- **IoT control.** Washers/dryers run on WISE-4051 controllers over MQTT.
- **Reliability first.** Outbox + Saga + Redis lock + Idempotency keys are not
  optional — they keep the Order FSM and Machine FSM in sync.

Two state machines stay **separate** and sync via events:
- Order FSM (business): CREATED → RESERVED → PAYMENT_PENDING → PAID → RUNNING → COMPLETED (+ AWAITING_APPROVAL, REFUND_PENDING, EXPIRED, …)
- Machine FSM (device): OFFLINE → IDLE → RESERVED → STARTING → RUNNING → FINISHING → IDLE (+ PAUSED, ERROR, MAINTENANCE)

---

## 2. Tech stack (see tool table image for rationale)

| Concern | Choice |
|---|---|
| Monorepo | Nx |
| Business services | NestJS (TypeScript) |
| OCR / Risk | Python · FastAPI (PaddleOCR) |
| Mobile apps | React Native (Expo) |
| Web portals | React + Vite |
| API Gateway | Traefik + NestJS BFF |
| Auth / RBAC | Keycloak |
| Database | PostgreSQL + TimescaleDB |
| Cache / Lock | Redis |
| Event bus | NATS JetStream |
| Saga / Workflow | Temporal |
| Object storage | MinIO |
| MQTT broker | EMQX |
| Maps | Google Maps Platform |
| Notifications | FCM + SMS gateway + SMTP + Socket.IO |
| Observability | Prometheus · Grafana · Loki · Tempo · Alertmanager · OpenTelemetry |
| Orchestration | Docker Compose (dev) → k3s (prod) |
| CI/CD | GitHub Actions |
| Backup/DR | pgBackRest + restic |
| Contracts | OpenAPI 3.1 + JSON Schema events |

---

## 3. Monorepo structure

```
smartwash/
├── apps/
│   ├── customer-app/         # React Native (Expo)
│   ├── driver-app/           # React Native (Expo)
│   ├── owner-portal/         # React + Vite
│   ├── admin-portal/         # React + Vite
│   └── bff/                  # NestJS backend-for-frontend (aggregates for apps)
├── services/
│   ├── auth/                 # NestJS  (+ Keycloak adapter)
│   ├── rbac/                 # NestJS  (policy lookup)
│   ├── order/                # NestJS  (Order FSM, order_events)
│   ├── queue/                # NestJS  (queue_entries, reservation TTL)
│   ├── payment/              # NestJS  (payment_requests, slips, QR)
│   ├── ocr/                  # FastAPI (PaddleOCR)
│   ├── fraud/                # NestJS  (dedup, validation)
│   ├── risk/                 # FastAPI (rules → ML later)
│   ├── wallet/               # NestJS  (balance cache)
│   ├── ledger/               # NestJS  (append-only ledger)
│   ├── settlement/           # NestJS  (settlements, staff payout)
│   ├── reconciliation/       # NestJS  (bank-statement matching)
│   ├── machine/              # NestJS  (Machine FSM, MQTT bridge, telemetry)
│   ├── delivery/             # NestJS  (Delivery FSM)
│   ├── gps/                  # Go OR NestJS (location ingest + WS fanout)
│   ├── notification/         # NestJS  (push/ws/email/sms)
│   ├── saga/                 # Temporal workers (wash_order, topup sagas)
│   └── audit/                # NestJS  (append-only audit_log)
├── libs/
│   ├── contracts/            # OpenAPI specs + generated clients/types
│   ├── events/               # versioned event schemas (shared pub/sub)
│   ├── db/                   # migrations (the SQL schema), shared repo helpers
│   ├── common/               # logging, OTel tracing, idempotency, errors, money(kip)
│   └── ui/                   # shared React components + design tokens
├── infra/
│   ├── docker/               # Dockerfiles + docker-compose.dev.yml
│   ├── k8s/                  # k3s manifests / helm charts
│   ├── ansible/              # on-prem provisioning
│   ├── terraform/            # cloud (optional)
│   ├── observability/        # prometheus, grafana dashboards, loki, tempo, alertmanager
│   ├── mqtt/                 # EMQX config + ACLs + TLS
│   └── db/                   # init schema, pgBackRest config
├── tools/                    # codegen, scripts
├── docs/                     # ADRs, runbooks, this plan, diagrams
├── .github/workflows/        # CI/CD
├── nx.json
├── package.json
└── README.md
```

### Per-service internal layout (NestJS, hexagonal)

```
services/<svc>/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── api/            # controllers (REST) + DTOs (validated)
│   ├── domain/         # entities, value objects, state machine
│   ├── application/    # use-cases / command + event handlers
│   ├── infra/
│   │   ├── db/         # repositories, migrations
│   │   ├── events/     # NATS publishers/consumers + outbox relay
│   │   └── external/   # clients (OCR, MinIO, Maps, Keycloak)
│   ├── config/
│   └── health/         # /health/live, /health/ready, /metrics
├── test/               # unit + integration (Testcontainers)
├── Dockerfile
└── project.json
```

---

## 4. Non-negotiable conventions

1. **Money is BIGINT in kip.** No floats for money, anywhere.
2. **Ledger is append-only.** Never UPDATE/DELETE `ledger_entries`; corrections are
   new `ADJUSTMENT` / `REFUND_REVERSAL` rows.
3. **Every state-changing POST takes an `Idempotency-Key` header** (UUID v4),
   persisted in `idempotency_keys`.
4. **Outbox pattern:** a service writes its domain row + an `outbox` row in the
   same DB transaction; a relay publishes to NATS. No direct cross-service writes.
5. **Sagas via Temporal.** `wash_order` saga owns the multi-step
   reserve → pay → start → finish flow with compensation. No ad-hoc orchestration.
6. **Redis SETNX with TTL** for machine reservation locks (15 min).
7. **OpenTelemetry everywhere** — propagate `correlation-id` across every hop;
   export traces (Tempo), metrics (Prometheus), logs (Loki).
8. **RBAC enforced at the gateway and re-checked in services** (defense in depth).
9. **Slip `slip_hash` (SHA-256) is UNIQUE** — DB-level fraud dedup.
10. **Machine FSM ≠ Order FSM.** Sync only through events; never bake payment
    state into the device state machine.

---

## 5. Build order (phased)

**Phase 0 — Foundation**
Nx monorepo; `libs/common` (logging, OTel, idempotency, money); `libs/db` with the
schema migration; `docker-compose.dev.yml` (Postgres+Timescale, Redis, NATS,
EMQX, MinIO, Keycloak, Temporal); observability stack; CI skeleton.

**Phase 1 — Identity + Core**
Auth (Keycloak), RBAC, Order, Queue, BFF/Traefik, minimal Customer app
(service selection → machine list).

**Phase 2 — Payment chain (the No-Bank-API core)**
Payment (QR + slip), OCR, Fraud, Risk, Wallet, Ledger. Implement **Topup flow**
end-to-end. Add Outbox + Idempotency + Temporal saga skeleton.

**Phase 3 — Machine + IoT**
Machine service + EMQX + WISE-4051 (cmd/status/lwt topics), real-time status via
Socket.IO, self-service wash flow, **dual-FSM sync** through the wash_order saga.

**Phase 4 — Delivery**
Delivery FSM, GPS ingest + live tracking, Driver app, Google Maps, pickup flow.

**Phase 5 — Finance + Portals**
Settlement (staff payout), Reconciliation (daily bank-statement match), Owner +
Admin portals, dashboards (Owner KPIs + Ops KPIs incl. recon status).

**Phase 6 — Hardening**
Full Saga compensation paths, refund flows, backup/DR, k3s deploy, load test (k6),
security pass (RBAC, rate-limit, TLS, MQTT ACL).

---

## 6. MQTT topic plan (WISE-4051)

```
smartwash/<branch>/<machine>/cmd      # downlink: START/STOP  (QoS 2)
smartwash/<branch>/<machine>/status   # uplink: telemetry     (QoS 1)
smartwash/<branch>/<machine>/lwt      # Last Will → OFFLINE detection
```
Status payload: `{ machineId, branchId, status, progress, remaining, ts }`.
Heartbeat timeout (no status for N s) → Machine FSM → OFFLINE → cancel/refund hook.

---

## 7. What to generate first (agent kickoff)

1. Scaffold the Nx monorepo + `libs/common`, `libs/db`, `libs/events`, `libs/contracts`.
2. Apply the SQL schema as the first migration.
3. Stand up `docker-compose.dev.yml` with all infra dependencies.
4. Generate the `payment`, `ledger`, and `order` services first (the financial
   spine), wired through Outbox + NATS, with the Topup flow as the first
   working end-to-end path.
5. Only then add `machine` + MQTT and the dual-FSM saga.

Each service ships with: OpenAPI spec, health + /metrics endpoints, OTel
instrumentation, unit + Testcontainers integration tests, Dockerfile.
