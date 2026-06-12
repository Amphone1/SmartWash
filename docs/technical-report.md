# SmartWash v5 — Technical Report

> Generated: 2026-06-11 | Branch: main | Phase: 1 (Identity + Core) complete; phases 2–5 scaffolded

---

## 1. Architecture Overview

SmartWash is an enterprise multi-tenant laundry platform for Laos built as an **Nx monorepo** of microservices, two mobile apps, two web portals, and a shared library set. The architecture is event-driven, saga-coordinated, and IoT-connected.

### High-level topology

```
Mobile (React Native)          Web (React+Vite)
  customer-app  driver-app      owner-portal  admin-portal
         │              │              │             │
         └──────────────┴──────────────┴─────────────┘
                               │
                         Traefik Gateway
                    /api/bff  /api/auth  (only these exposed)
                               │
                    ┌──────────┴──────────┐
                   BFF (NestJS)        Auth (NestJS+Keycloak)
                    │
         ┌──────────┼──────────────────────────────────────┐
         │          │          │          │                 │
       Order     Payment    Ledger    Machine    Delivery / GPS
       Queue      Fraud      Wallet   (MQTT↔EMQX)  Settlement
        RBAC       OCR       Risk       Saga       Reconciliation
       Audit    Notification                        (+ more)
         │          │          │          │                 │
         └──────────┴──────────┴──────────┴─────────────────┘
                               │
              PostgreSQL+TimescaleDB  Redis  NATS JetStream  MinIO
```

- **Traefik v3.1** is the only public edge. Only `/api/bff` and `/api/auth` are routed. All other services are network-isolated and reachable only via the BFF using a shared `X-Internal-Token` secret.
- **BFF** (Backend-For-Frontend) aggregates downstream service calls on behalf of apps, enforces bearer-token auth via Keycloak introspection, and re-checks RBAC before forwarding.
- **NATS JetStream** is the async event bus. Services write to the `outbox` table in the same DB transaction as the domain row, then a per-service `OutboxRelay` polls and publishes — guaranteeing exactly-once event delivery within each transaction boundary.
- **Temporal** is used exclusively for multi-step sagas (`wash_order`, `topup`, `delivery_order`). No other orchestration exists.
- **EMQX** is the MQTT broker for WISE-4051 device controllers. The Machine service subscribes to `smartwash/+/+/status` and `smartwash/+/+/lwt`.

---

## 2. Frontend / App Structure

### 2.1 Customer App (`apps/customer-app` — React Native / Expo)

**Current state (Phase 1):** minimal flow — paste bearer token → pick service type → list branches → list machines.

| Screen | Description |
|--------|-------------|
| `token` | Bare token paste input (no Keycloak SSO yet) |
| `service` | Service-type picker: self-service / pickup / delivery |
| `branches` | `GET /bff/branches` — flat list of open branches |
| `machines` | `GET /bff/branches/:id/machines` — machine list with state + price |

State is managed with plain React `useState`; no navigation library. The full phase target includes: wallet top-up, QR scan, order creation, real-time wash progress, delivery tracking, notification inbox.

### 2.2 Driver App (`apps/driver-app` — React Native / Expo)

**Current state (Phase 4 skeleton):** list assigned deliveries, accept/reject, step through delivery FSM states, report GPS location.

Delivery state machine rendered client-side via `NEXT` lookup table:
`ACCEPTED → EN_ROUTE_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED → (Complete)`

### 2.3 Owner Portal (`apps/owner-portal` — React + Vite)

**Current state (Phase 5 skeleton):** single KPI card dashboard — revenue today, orders today, machine utilisation ratio. Reads `GET /bff/owner/summary`.

### 2.4 Admin Portal (`apps/admin-portal` — React + Vite)

**Current state (Phase 5 skeleton):** system-wide KPI grid + reconciliation run table. Reads `GET /bff/admin/summary` and `GET /bff/admin/reconciliation`.

Notable: reconciliation anomalies (review/suspicious/orphan) are colour-coded in amber/red. Admin can trigger a reconciliation run via `POST /bff/admin/reconciliation/run`.

---

## 3. Backend Service Catalogue

| Service | Language | Port | Responsibility |
|---------|----------|------|---------------|
| `auth` | NestJS | 3001 | Keycloak adapter: `/auth/me`, `/auth/introspect` |
| `rbac` | NestJS | 3002 | Policy lookup: `POST /rbac/check`, `GET /rbac/users/:id/permissions` |
| `order` | NestJS | 3003 | Order FSM, order_events; NATS outbox |
| `queue` | NestJS | 3004 | Queue entries, reservation TTL |
| `bff` | NestJS | 3005 | API aggregation, auth/RBAC gateway |
| `wallet` | NestJS | 3006 | Wallet balance cache |
| `ledger` | NestJS | 3007 | Append-only ledger; advisory-lock atomic posts |
| `fraud` | NestJS | 3008 | Slip dedup + rule evaluation |
| `payment` | NestJS | 3009 | Payment requests, slip upload, QR, FSM |
| `machine` | NestJS | 3010 | Machine FSM, MQTT bridge, heartbeat sweep |
| `delivery` | NestJS | 3012 | Delivery FSM, Haversine/Maps fee calc |
| `gps` | NestJS | 3013 | GPS ingest + WS fanout |
| `settlement` | NestJS | 3014 | Daily settlement, driver payout |
| `reconciliation` | NestJS | 3015 | Bank statement matching |
| `notification` | NestJS | 3016 | Push/WS/email/SMS dispatch |
| `audit` | NestJS | 3017 | Append-only audit_log via internal endpoint |
| `saga` | Temporal worker | — | `topup`, `wash_order`, `delivery_order` workflows |
| `ocr` | FastAPI (Python) | 8001 | PaddleOCR slip parsing |
| `risk` | FastAPI (Python) | 8002 | Rules-based risk scoring (ML deferred) |
| `device-sim` | NestJS | — | MQTT device simulator for dev/test |

### Per-service hexagonal layout (NestJS)

```
src/
  api/          ← controllers + DTOs (validation boundary)
  domain/       ← entities, value objects, FSMs (pure logic)
  application/  ← use-case services (commands + event handlers)
  infra/
    db/         ← pg repositories
    events/     ← NATS publishers/consumers, outbox relay
    external/   ← HTTP clients (OCR, MinIO, etc.)
  config/
  health/       ← /health/live, /health/ready, /metrics
```

---

## 4. API Flow

### 4.1 Public API surface (through Traefik)

All client traffic enters at port 8088 (HTTP) or 8443 (HTTPS). Traefik applies a coarse IP rate limit (100 req/min average, burst 50) and routes to:

| Public path | Service |
|-------------|---------|
| `/api/bff/**` | BFF service |
| `/api/auth/**` | Auth service |

All other services are **not reachable externally**.

### 4.2 BFF route map

```
GET  /bff/branches                      → catalog: list branches
GET  /bff/branches/:branchId/machines   → catalog: machines + status

POST /bff/orders                        → order: create order
GET  /bff/orders/:id                    → order: get order
POST /bff/orders/:id/start              → saga trigger: start wash
POST /bff/orders/:id/request-delivery   → order + delivery: start delivery

POST /bff/queues/:machineId/join        → queue: join queue

POST /bff/payments                      → payment: create QR
POST /bff/payments/:qrRef/slip          → payment: upload slip (triggers topup saga)
GET  /bff/payments/:qrRef               → payment: check status
GET  /bff/wallet                        → wallet: balance
GET  /bff/notifications                 → notification: inbox

GET  /bff/deliveries/:id                → delivery: get
GET  /bff/deliveries/:id/track          → GPS: live tracking

POST /bff/driver/deliveries/:id/accept  → delivery: driver accept
POST /bff/driver/deliveries/:id/reject  → delivery: driver reject
POST /bff/driver/deliveries/:id/advance → delivery: advance FSM
POST /bff/driver/deliveries/:id/complete→ delivery: complete
POST /bff/driver/location               → GPS: report location

GET  /bff/owner/summary                 → reporting: KPI summary
GET  /bff/owner/settlements             → reporting: settlement list
GET  /bff/admin/summary                 → reporting: ops summary
GET  /bff/admin/reconciliation          → reporting: recon runs
GET  /bff/admin/audit                   → audit: audit log
POST /bff/admin/settlements/run         → settlement: run
POST /bff/admin/reconciliation/run      → reconciliation: run
```

### 4.3 Topup flow (Payment chain)

```
Customer                BFF              Payment       OCR       Risk      Fraud     Ledger     Temporal
   │──POST /bff/payments──►│                │                                                       │
   │                       │──POST /payments►│                                                       │
   │                       │                │ create payment_request, qr_ref                        │
   │◄── { qrRef, qrPayload }──│                │                                                       │
   │                       │                │                                                       │
   │──POST /bff/payments/:qrRef/slip──►│                                                             │
   │   (Idempotency-Key, slip image)    │──POST /payments/:qrRef/slip►│                              │
   │                                   │                │ SHA-256 hash, store image in MinIO         │
   │                                   │                │──────────────────────────── start topup workflow ►│
   │                                   │                │                                    │(topupWorkflow)│
   │                                   │                │              │◄──ocrParse──│        │               │
   │                                   │                │              │──ocr result─►│        │               │
   │                                   │                │                       │◄──riskScore──│               │
   │                                   │                │                              │◄──fraudEvaluate──│     │
   │                                   │                │◄──applyDecision──────────────────────────────│     │
   │                                   │                │                                               │     │
   │                                   │                │◄──postLedgerTopup (TOPUP, idempotent)──────────────►│
   │                                   │                │                                                     │
   │◄──GET /bff/payments/:qrRef (poll)──│──►│                                                                  │
   │            { state: APPROVED }     │                │                                                     │
```

### 4.4 Wash order flow (wash_order saga)

```
Order created (state=CREATED, RESERVED)
    │
    ▼
POST /bff/orders/:id/start
    │
    ▼ [Temporal washOrderWorkflow]
1. machineReserve   → Redis SETNX lock + Machine=RESERVED
2. walletBalance    → balance check (soft pre-check)
3. deductWallet     → Ledger DEDUCT (pg advisory lock, idempotent) → Order=PAID
4. machineStart     → MQTT publish smartwash/{branch}/{machine}/cmd
5. await 'running' signal (MachineRunning event via NATS → saga signal)
   → Order=RUNNING
6. await 'finished' signal (MachineFinished / timeout / error / offline)
   → if error/timeout: pro-rata refund + Order=REFUNDED
   → if success: Order=COMPLETED + release lock
```

---

## 5. Database Design

### Engine
PostgreSQL 16 + TimescaleDB, hosted on `timescale/timescaledb:latest-pg16`.

### Schema highlights

The schema uses:
- **UUID PKs** (`gen_random_uuid()`) on all domain tables
- **BIGINT for all money** in kip — no NUMERIC, no DECIMAL, no float
- **`TIMESTAMPTZ` everywhere** — UTC throughout
- **PostgreSQL ENUMs** for all state machines (enforced at DB layer)
- **Append-only tables**: `ledger_entries`, `order_events`, `machine_events`, `audit_log` — never UPDATE/DELETE

### Core entity groups

**Identity & RBAC**
- `users` → `user_roles` (branch-scoped) → `roles` → `role_permissions` → `permissions`
- `branches` (lat/lng, open/close times, owner_account)
- `drivers` (linked to users, branch-scoped, state FSM)

**Machines**
- `machines` (code, type, capacity_kg, price BIGINT)
- `machine_status` (1 row per machine, real-time snapshot updated by Machine service)
- `machine_events` (append-only telemetry history)

**Orders & Queue**
- `orders` (type, state, cycle, addons JSONB, subtotal/vat/total BIGINT)
- `order_events` (append-only FSM audit trail)
- `queue_entries` (position, called_at, expires_at)

**Payment & Finance**
- `payment_requests` (qr_ref UNIQUE, amount_expected BIGINT, expires_at)
- `slips` (slip_hash SHA-256 UNIQUE — DB-level fraud dedup, ocr_json JSONB)
- `wallets` (balance BIGINT — **cache only**; source of truth = ledger)
- `ledger_entries` (**APPEND-ONLY**: type TOPUP/DEDUCT/REFUND_REVERSAL/ADJUSTMENT, amount signed BIGINT, balance_after BIGINT, idempotency_key UNIQUE)
- `risk_scores` (score 0-100, factors JSONB, time-series)
- `refunds` (references ledger_entries.id — closes audit gap)

**Finance / Ops**
- `settlements` + `settlement_lines` (per-branch daily settlement, driver payouts)
- `reconciliation_runs` + `bank_statement_lines` (bank CSV matching)

**Delivery & GPS**
- `deliveries` (state FSM, pickup/dropoff coords, fee BIGINT)
- `driver_locations` (high-volume pings — TimescaleDB hypertable candidate)

**Reliability**
- `outbox` (state PENDING/PUBLISHED/FAILED, publish relay deduplication)
- `idempotency_keys` (persisted per-operation — dedup replays)
- `saga_instances` (Temporal workflow tracking)
- `audit_log` (actor, action, entity, before/after JSON, IP)

### Key indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `machine_status` | `(branch_id, state)` | Machine availability lookup |
| `orders` | `(user_id, created_at DESC)` | Order history pagination |
| `ledger_entries` | `(user_id, created_at DESC)` | Balance history |
| `outbox` | `(created_at) WHERE state='PENDING'` | Relay polling — partial index |
| `saga_instances` | `(state) WHERE state IN (RUNNING, COMPENSATING)` | Active saga monitoring |
| `queue_entries` | `(machine_id, position) WHERE status='IN_QUEUE'` | Queue ordering |

---

## 6. Routes & Screens Summary

### Customer App (React Native)
| Step | What happens |
|------|-------------|
| Token entry | Bare bearer token (Phase 1 placeholder) |
| Service selection | `self_service` / `pickup` / `delivery` |
| Branch list | `GET /bff/branches` |
| Machine list | `GET /bff/branches/:id/machines` |
| *(Planned)* | Top-up QR, order creation, wash progress, delivery map, notification centre |

### Driver App (React Native)
| Action | API call |
|--------|---------|
| Load deliveries | `GET /bff/driver/deliveries` |
| Accept | `POST /bff/driver/deliveries/:id/accept` |
| Reject | `POST /bff/driver/deliveries/:id/reject` |
| Advance FSM | `POST /bff/driver/deliveries/:id/advance` |
| Complete | `POST /bff/driver/deliveries/:id/complete` |
| Report location | `POST /bff/driver/location` |

### Owner Portal (React + Vite)
| View | Data source |
|------|------------|
| KPI dashboard | `GET /bff/owner/summary` |
| Settlements list | `GET /bff/owner/settlements` |

### Admin Portal (React + Vite)
| View | Data source |
|------|------------|
| Ops KPIs | `GET /bff/admin/summary` |
| Reconciliation table | `GET /bff/admin/reconciliation` |
| Audit log | `GET /bff/admin/audit` |
| Trigger settlement | `POST /bff/admin/settlements/run` |
| Trigger recon | `POST /bff/admin/reconciliation/run` |

---

## 7. Security Analysis

### Strengths

| Control | Implementation |
|---------|---------------|
| Network isolation | Only BFF+Auth exposed through Traefik; all other services hidden on Docker internal network |
| Bearer token auth | Keycloak JWT introspection on every BFF request via `BffAuthGuard` |
| Defense-in-depth RBAC | Enforced at BFF (`PermissionsGuard`) **and** re-checked inside services (`RbacGuard`) — neither layer trusts the other |
| Internal service auth | `InternalTokenGuard` using `timingSafeEqual` (constant-time comparison) — fails closed if `INTERNAL_SERVICE_TOKEN` is unset |
| Idempotency | `Idempotency-Key` header required on all state-changing POSTs; persisted in `idempotency_keys`; prevents double-charges |
| Fraud dedup | `slips.slip_hash` (SHA-256) is a UNIQUE constraint at DB level — a re-uploaded slip fails before any business logic runs |
| Rate limiting | Two layers: Traefik coarse IP limit (100/min) + NestKit `RateLimitGuard` per-route/user via Redis fixed-window |
| Ledger integrity | Append-only with `pg_advisory_xact_lock` per user — no concurrent balance race; overdraft guard in repository |
| Money type safety | `Kip = bigint` primitive; `toKip()` rejects fractions/NaN at boundary — floats cannot enter the ledger path |
| MQTT ACLs | EMQX ACL enforces backend vs device role; default deny |

### Issues & Gaps

#### HIGH — Secrets in `infra/.env` committed to the repository
**Finding:** `infra/.env` contains default passwords (`change_me`, `change_me_internal`) that are committed to version control. While they are placeholder strings, the file format and real values are visible if contributors copy without replacement.
**Risk:** If real credentials ever land here they are immediately in git history. This file should not be tracked.
**Recommendation:** Add `infra/.env` to `.gitignore`; use `infra/.env.example` (already present) as the only committed template; rotate all secrets for any non-local deployment.

#### HIGH — `INTERNAL_SERVICE_TOKEN` is a single shared secret
**Finding:** All 17 NestJS services and the saga worker share one token (`change_me_internal`). A compromised service can call any internal endpoint of any other service.
**Risk:** No service-to-service identity; blast radius of a single service compromise is the entire backend.
**Recommendation:** Use mTLS or per-service SPIFFE/X.509 certificates (via SPIRE or k3s cert-manager) for production. The single shared secret is acceptable for dev but must be replaced before a multi-tenant production deployment.

#### MEDIUM — MQTT devices share a single credential
**Finding:** All WISE-4051 devices authenticate to EMQX with `MQTT_USERNAME=device` (shared credential). The ACL comment notes this should be hardened per-device in production but it is not done yet.
**Risk:** A compromised device can publish telemetry or Last Will messages for any other machine, potentially manipulating the Machine FSM for machines it doesn't own.
**Recommendation:** Issue per-device credentials keyed by `clientid` and scope the ACL with `${clientid}` placeholders as documented in `infra/mqtt/acl.conf`.

#### MEDIUM — Customer app stores bearer token in plaintext component state
**Finding:** `customer-app/App.tsx` holds the JWT in `useState('token')`. React Native does not persist this, but there is no Secure Storage (`expo-secure-store`) usage, and the Phase 1 flow requires the user to paste their token manually.
**Risk:** Token never hits secure storage; logs/crash reports could capture it. More critically, the current flow has no actual OAuth login — the user pastes a raw JWT.
**Recommendation:** Integrate Keycloak PKCE flow via `expo-auth-session`; store token refresh pair in `expo-secure-store`; never log or display token values.

#### MEDIUM — BFF forwards `X-User-Id` as a plain header
**Finding:** Services read user identity from the `X-User-Id` header set by the BFF. There is no cryptographic binding — if a client somehow reached an internal endpoint directly (misconfigured firewall), they could spoof any user ID.
**Risk:** Header spoofing on internal endpoints if network isolation ever fails.
**Recommendation:** The `InternalTokenGuard` partially mitigates this, but consider signing the forwarded identity header (HMAC of `userId:correlationId:timestamp`) so services can verify the BFF set it.

#### LOW — Traefik TLS is self-signed in dev with no automatic redirect
**Finding:** The Traefik config enables `websecure` with `tls: {}` (Traefik self-signed) but does not configure `http.redirections` to force HTTP→HTTPS. Comments show where ACME should be configured.
**Risk:** Dev traffic is plaintext by default; developers may not notice the difference.
**Recommendation:** Add ACME resolver and HTTP→HTTPS redirect before staging deployment.

#### LOW — OCR/Risk services have no authentication
**Finding:** `services/ocr` (FastAPI) and `services/risk` (FastAPI) do not appear to implement any authentication on their endpoints. They rely entirely on network isolation.
**Risk:** If reachable on the compose network by a compromised service, they can be queried freely.
**Recommendation:** Add a `X-Internal-Token` check to both FastAPI services, consistent with the NestJS pattern.

#### LOW — Rate limit key uses `req.ip` which may be `undefined` in some proxy configurations
**Finding:** In `libs/nestkit/src/security/rate-limit.guard.ts`, the key falls back to `'anon'` when `req.ip` is undefined. If a misconfigured reverse proxy strips the IP, all anonymous requests share one bucket.
**Risk:** Effective rate limit becomes the per-IP limit applied to _all_ traffic, not per-client.
**Recommendation:** Assert `X-Forwarded-For` is configured in Traefik forwarding headers; add a warning log if `req.ip` is undefined.

---

## 8. Performance Analysis

### Strengths

| Pattern | Why it matters |
|---------|---------------|
| Append-only `ledger_entries` + advisory lock | Serializes per-user ledger operations without table-level locks; other users are unaffected |
| Redis SETNX machine locks | O(1) lock with TTL; avoids DB polling for reservation state |
| Outbox relay batch polling | Configurable batch size + poll interval; relay never blocks the request path |
| Partial index on `outbox` | `WHERE state='PENDING'` index is tiny; the relay query reads only unpublished rows |
| `driver_locations` TimescaleDB hypertable | High-volume GPS pings can use time-based chunking and automatic retention policies |
| NATS JetStream dedup | `dedupId = outbox.id` prevents duplicate processing without extra round-trips |
| Wallet balance cache | `wallets.balance` saves a ledger aggregate on every read; invalidated atomically in the ledger transaction |

### Issues & Concerns

#### HIGH — `pg_advisory_xact_lock(hashtext($1))` is susceptible to hash collisions
**Finding:** The ledger repository uses `hashtext(userId)` (a 32-bit integer hash) as the advisory lock key. With ~4 billion possible hashes and potentially thousands of users, the birthday probability of two users sharing a lock key is non-trivial at scale (~0.01% chance with 10k users).
**Risk:** Two unrelated users could serialize against each other's ledger operations, creating unnecessary contention and latency spikes.
**Recommendation:** Use `hashtext(userId) :: bigint` (64-bit via `('x' || md5(userId))::bit(64)::bigint`) or keep a deterministic integer user sequence and use that as the lock key directly.

#### HIGH — Outbox relay `FAILED` rows are never retried
**Finding:** `outbox-relay.ts` marks a row `FAILED` on publish error but there is no retry loop that re-publishes FAILED rows. Once a row is FAILED it is stuck permanently.
**Risk:** Events that fail during a transient NATS outage are permanently lost, breaking the at-least-once guarantee.
**Recommendation:** Add a separate retry sweep that moves FAILED rows back to PENDING after a back-off delay, up to a configurable max_attempts; alert when a row exceeds max_attempts.

#### MEDIUM — Outbox relay polls every 1 second unconditionally
**Finding:** `OUTBOX_POLL_MS` defaults to 1000ms. Every service with the relay enabled hits the database once per second regardless of load.
**Risk:** With 10+ services, that is 10+ DB queries/second just for the relay at idle; under no load this is wasteful.
**Recommendation:** Implement a LISTEN/NOTIFY trigger on the `outbox` table to wake the relay immediately on insert, falling back to the poll interval only as a safety net. This eliminates idle polling entirely.

#### MEDIUM — Ledger `listEntries` has no index-only scan path
**Finding:** `listEntries` runs `SELECT * FROM ledger_entries WHERE user_id=$1 ORDER BY id DESC` — the `idx_ledger_user_time` index is on `(user_id, created_at DESC)` but the query orders by `id`. The index is not used for the sort.
**Risk:** For users with many ledger entries, the query degrades to a full index scan sorted in-memory.
**Recommendation:** Either change the index to `(user_id, id DESC)` to match the query ordering, or change the query to `ORDER BY created_at DESC` to match the existing index. A cursor-keyed endpoint (already implemented) limits rows but the sort must still be efficient.

#### MEDIUM — No connection pool limits are configured for downstream services
**Finding:** The BFF's `service-client.ts` uses `fetch()` directly; NestJS services use `node-postgres` pools. No explicit pool size or connection timeout limits are visible in the compose configuration.
**Risk:** Under burst load, connection exhaustion against PostgreSQL is possible (default pg pool is unbounded in node-postgres).
**Recommendation:** Set `max` connection pool size in `libs/nestkit/src/db/pg.ts` proportional to container memory and Postgres `max_connections`; set statement/connection timeouts.

#### LOW — `wallets.balance` can diverge from ledger on crash
**Finding:** The wallet balance cache is updated inside the same ledger transaction (`postAtomic` writes to `ledger_entries` and the relay publishes `smartwash.ledger.posted.v1`), but `wallets.balance` itself is not updated in the same transaction — the wallet service presumably listens to the NATS event and updates asynchronously.
**Risk:** A crash between ledger commit and wallet event consumption leaves the cache stale. Reads of `wallets.balance` return an incorrect value until the event is eventually consumed.
**Recommendation:** Confirm that the wallet service's event consumer is idempotent and that the `wallets` table update is included in the same DB transaction as acknowledging the NATS message. Alternatively, compute balance on-demand from the ledger when the wallet cache is absent.

#### LOW — `driver_locations` has no time-based partitioning or TTL
**Finding:** `driver_locations` is a plain append-only table. The schema comment notes it is a TimescaleDB hypertable candidate but this has not been implemented.
**Risk:** Unbounded growth; queries for recent locations degrade as the table grows.
**Recommendation:** Convert to a TimescaleDB hypertable partitioned by `recorded_at`; add a retention policy to drop data older than 30 days.

#### LOW — No HTTP timeout set on BFF-to-service `fetch()` calls
**Finding:** `libs/nestkit/src/shared/service-client.ts` (and BFF's `service-client.ts`) use bare `fetch()` without an `AbortController` / signal timeout.
**Risk:** A slow downstream service (e.g. OCR parsing a large image) can hold a BFF connection open indefinitely, exhausting the Node.js event loop under concurrent load.
**Recommendation:** Add `AbortController` with a configurable timeout (e.g. 10s for ledger/order, 30s for OCR) to all service-client fetch calls.

---

## 9. Observability

The stack ships a full OTEL pipeline:

| Component | Purpose |
|-----------|---------|
| OpenTelemetry SDK (every service) | Traces, metrics, correlation-id propagation |
| Tempo 2.7.1 | Trace storage (OTLP HTTP on :4318) |
| Prometheus | Metrics scrape from `/metrics` on each service |
| Loki | Log aggregation |
| Grafana | Dashboards for all above |
| Alertmanager | Alert routing |

`correlation-id` is propagated across all hops via `libs/nestkit/src/correlation/correlation.ts` and forwarded as a header between services.

---

## 10. Infrastructure & Deployment

| Environment | Orchestration |
|-------------|--------------|
| Development | Docker Compose (`infra/docker/docker-compose.dev.yml`) |
| Production | k3s Kubernetes (`infra/k8s/`) with Traefik IngressRoute |

**Backup/DR:** pgBackRest config present at `infra/backup/pgbackrest.conf`; k3s CronJob at `infra/k8s/backup-cronjob.yaml`.

**CI/CD:** `.github/workflows/` scaffolded (Phase 0).

---

## 11. Current Build Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Foundation | ✅ Complete | Nx monorepo, schema, compose, CI skeleton |
| 1 — Identity + Core | ✅ Complete | Auth, RBAC, Order, Queue, BFF, minimal Customer app |
| 2 — Payment chain | ✅ Scaffolded | Payment, OCR, Fraud, Risk, Wallet, Ledger, Topup saga |
| 3 — Machine + IoT | ✅ Scaffolded | Machine FSM, MQTT bridge, wash_order saga, device sim |
| 4 — Delivery | ✅ Scaffolded | Delivery FSM, GPS, Driver app, delivery_order saga |
| 5 — Finance + Portals | ✅ Scaffolded | Settlement, Reconciliation, Owner + Admin portals |
| 6 — Hardening | ⏳ Not started | Full saga compensation, load tests, k3s production deploy, security pass |

---

## 12. Summary Recommendations

### Immediate (before Phase 6 hardening)

1. **Add `infra/.env` to `.gitignore`** — never commit live credentials.
2. **Fix outbox FAILED retry** — add a back-off retry sweep; otherwise events are silently lost on transient NATS outages.
3. **Fix ledger list sort index** — change `idx_ledger_user_time` to `(user_id, id DESC)` to match the cursor-pagination query.
4. **Harden OCR/Risk with internal token** — FastAPI services accept calls from any service on the compose network.

### Before production

5. **Per-device MQTT credentials** — as documented in `infra/mqtt/acl.conf`.
6. **Replace shared `INTERNAL_SERVICE_TOKEN`** — move to mTLS or per-service identity.
7. **Replace customer app token-paste** with Keycloak PKCE + `expo-secure-store`.
8. **Configure PostgreSQL pool limits** and statement timeouts in `libs/nestkit`.
9. **Convert `driver_locations` to TimescaleDB hypertable** with retention policy.
10. **Add request timeouts to all `fetch()` service client calls**.
