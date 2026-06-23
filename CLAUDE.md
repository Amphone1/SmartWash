# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
3. `contracts/openapi/*.yaml` — REST contracts (order, payment, ledger)
4. `contracts/events/events.schema.json` — event envelope + payloads
5. `contracts/mqtt/mqtt.schema.json` — WISE-4051 cmd/status/lwt
6. `docs/saga/wash_order.md` — saga forward + compensation
7. `docs/RUNBOOK.md` — E2E seed, token minting, Docker Desktop quirks

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

These touch money or security — propose a diff and wait.

## Current phase

> **PHASE 1** — Identity + Core (Auth/Keycloak, RBAC, Order, Queue, BFF/Traefik,
> minimal Customer app). Phase 0 foundation complete and approved.

---

## Monorepo structure

```
smartwash/
├── apps/
│   ├── smartwash-app/        # Flutter super app (Customer · Driver · Staff) — PRIMARY
│   ├── customer-app/         # React Native/Expo — RETIRING, reference only
│   ├── driver-app/           # React Native/Expo — RETIRING, reference only
│   ├── owner-portal/         # React + Vite (Dashboard, Machines, Orders, Settlements, SlipReview)
│   └── admin-portal/         # React + Vite (Analytics, Branches, Dashboard, Drivers, Orders, Payments)
├── services/
│   ├── auth/                 # Keycloak adapter + token introspection
│   ├── rbac/                 # Permission policy lookup
│   ├── bff/                  # NestJS Backend-for-Frontend — the only public gateway surface
│   ├── order/                # Order FSM, ratings
│   ├── queue/                # Queue entries, reservation TTL
│   ├── payment/              # Payment requests, slips, QR
│   ├── ledger/               # Append-only ledger entries
│   ├── wallet/               # Balance cache (derived from ledger)
│   ├── fraud/                # Dedup + slip validation
│   ├── ocr/                  # FastAPI + PaddleOCR (slip parsing)
│   ├── risk/                 # FastAPI risk scoring (rules → ML later)
│   ├── machine/              # Machine FSM + MQTT bridge + telemetry
│   ├── saga/                 # Temporal workers: wash_order + topup workflows
│   ├── delivery/             # Delivery FSM
│   ├── gps/                  # Location ingest + WebSocket fanout
│   ├── notification/         # Push/WS/email/SMS
│   ├── settlement/           # Staff payout
│   ├── reconciliation/       # Daily bank-statement matching
│   ├── audit/                # Append-only audit log
│   └── device-sim/           # WISE-4051 simulator (set SIM_DEVICES env)
├── libs/
│   ├── common/               # Pure TS: money (Kip), errors, idempotency, OTel
│   ├── nestkit/              # NestJS modules: RBAC, Outbox, Idempotency, NATS, DB, Redis, MQTT
│   ├── contracts/            # OpenAPI specs + generated clients/types
│   └── db/                   # Migrations + shared repo helpers
├── infra/
│   ├── docker/               # docker-compose.dev.yml, docker-compose.lan.yml
│   ├── db/init/              # 01_schema.sql, 02_rbac_seed.sql, 03_…, 04_… (apply in order)
│   ├── traefik/dynamic.yml   # Traefik routing rules (restart container after edits)
│   ├── mqtt/acl.conf         # EMQX ACL (dev = anonymous, enable for prod only)
│   ├── k8s/                  # k3s manifests
│   └── observability/        # Prometheus, Grafana dashboards, Loki, Tempo, Alertmanager
├── tools/
│   ├── build-service.mjs     # Two-step NestJS build: tsc → esbuild (never replace with one pass)
│   └── k6/                   # Load test scripts (smoke.js, topup.js, wash.js)
├── docs/
│   ├── RUNBOOK.md            # Stack startup, seed, E2E happy paths, gotchas
│   └── saga/                 # Saga design + compensation audit
└── contracts/
    ├── openapi/              # order.yaml, payment.yaml, ledger.yaml
    └── events/events.schema.json
```

## Per-service shape (NestJS, hexagonal)

```
services/<svc>/src/
├── api/            # Controllers + DTOs (class-validator)
├── domain/         # Entities, value objects, FSM (pure, no side effects)
├── application/    # Use-cases / command + event handlers
├── infra/
│   ├── db/         # pg repositories
│   ├── events/     # NATS publishers/consumers
│   └── external/   # HTTP clients (OCR, MinIO, Maps, etc.)
├── config/
└── health/         # /health/live  /health/ready  /metrics
```

Every service exposes `/health/live`, `/health/ready`, `/metrics` and is wired for OTel.

## BFF — the public gateway

`services/bff/` is the only service with a host-facing port (via Traefik on **:8088**).
All frontend/mobile traffic goes through it. It:
- Validates JWT (`BffAuthGuard`) and re-checks permissions (`PermissionsGuard`)
- Aggregates responses from downstream services via HTTP clients (`infra/external/clients.ts`)
- Owns the `catalog` table (branches + machines) directly via its own DB pool
- Owns `reporting` queries (joined reads, no writes)
- Routes: `CatalogController`, `OrdersController`, `QueueController`, `TopupController`,
  `DriverController`, `DeliveryTrackController`, `ReportingController`, `AddressesController`,
  `StaffController`

Internal service-to-service calls use `X-Internal-Token` (validated by `InternalTokenGuard`).
**`INTERNAL_SERVICE_TOKEN` must be set or internal endpoints deny.**

## Shared libraries

**`@smartwash/common`** (`libs/common/`) — pure TS, no NestJS:
- `Kip = bigint` + `toKip()`, `add()`, `subtract()`, `multiply()`,
  `applyBasisPoints()` (VAT in basis points, e.g. 10% = 1000 bps), `formatKip()`
  — use these for ALL money arithmetic; never operate on raw numbers.
- Domain error classes: `ValidationError`, `ConflictError`, `IdempotencyConflictError`, …
- `hashRequest()`, `isUuidV4()` — idempotency helpers
- OTel span/correlation utilities

**`@smartwash/nestkit`** (`libs/nestkit/`) — NestJS modules, all re-exported from `src/index.ts`:
- `RbacModule` / `RbacGuard` / `@RequirePermission('x:y')` — forwards `X-User-Id`
  to the RBAC service; never trust an upstream permission decision.
- `InternalTokenGuard` — validates `X-Internal-Token` for service-to-service calls.
- `IdempotencyService.execute(key, scope, payload, fn)` — first call runs `fn`;
  subsequent identical calls replay; conflict on body mismatch.
- `OutboxRelay` — polls `outbox` (configurable via `OUTBOX_POLL_MS`,
  `OUTBOX_BATCH_SIZE`, `OUTBOX_AGGREGATE_TYPES`), publishes to NATS JetStream,
  dedup id = outbox row id.
- `NatsModule` / `EventBus` — JetStream pub/sub.
- `Database` / `PG_POOL` — pg pool token.
- `RedisModule`, correlation middleware, `RateLimitGuard`, `MinioModule`, `MqttModule`.

## State machines

All FSMs are pure modules in `src/domain/`; unit-tested with no side effects.

**Order FSM** (`services/order/src/domain/order-fsm.ts`):
```
CREATED → RESERVED → PAYMENT_PENDING → AWAITING_APPROVAL → PAID → RUNNING → COMPLETED
                  ↘ (any cancellable state) → CANCELLED / EXPIRED
                  RUNNING → REFUND_PENDING → REFUNDED / FAILED
                  PAYMENT_PENDING → REJECTED
```

**Payment Request FSM** (`services/payment/src/domain/payment-fsm.ts`):
```
PENDING → SLIP_UPLOADED → APPROVED
                        → REJECTED
                        → AWAITING_APPROVAL → APPROVED / REJECTED / EXPIRED
                        → EXPIRED
```

**Machine FSM** (`services/machine/src/domain/machine-fsm.ts`):
```
States: OFFLINE · IDLE · RESERVED · STARTING · RUNNING · FINISHING · PAUSED · ERROR · MAINTENANCE
```
Two transition sources:
- **DEVICE** (MQTT status uplinks): drives IDLE/STARTING/RUNNING/FINISHING/PAUSED/ERROR.
  A device IDLE uplink while the machine is RESERVED is silently ignored — never clobbers RESERVED.
- **COMMAND** (backend-driven): RESERVED, MAINTENANCE, OFFLINE (LWT/heartbeat timeout).

`eventForTransition()` maps state changes to domain events (`MachineRunning`, `MachineFinished`,
`MachineError`, `MachineOffline`) that the wash_order saga listens to.

## Saga summary

**wash_order** (Temporal, `services/saga/src/workflows.ts`):
ReserveMachine (Redis SETNX + Order=RESERVED) → EnsureFunds → DeductWallet (DEDUCT, Order=PAID)
→ StartMachine (MQTT + ACK, Order=RUNNING) → AwaitFinish (signal/timer) → FinalizeOrder (Order=COMPLETED).
- Each compensation step writes a new ledger row (REFUND_REVERSAL), never an UPDATE.
- Activity idempotency key = `{orderId}:{step}`. Workflow id = orderId.
- Refund policy on error: `WASH_REFUND_ON_ERROR` (`grace_pro_rata` default) +
  `WASH_REFUND_GRACE_PCT` (below this % progress → full refund).

**Topup saga** (`services/saga/src/workflows.ts` → `topupWorkflow`):
SlipUploaded → OCR → auto-match → RiskScore → FraudCheck → decision → LedgerTOPUP.
Manual-review path: workflow parks on `staffDecisionSignal` (Temporal signal) awaiting
approve/reject from staff; `STAFF_REVIEW_TIMEOUT_MS` → auto-reject on timeout.
Idempotency: workflowId = `topup:{qrRef}`, ledger key = `topup:{qrRef}` — retries never double-credit.

## MQTT topic plan

```
smartwash/<branch>/<machine>/cmd      # downlink: START/STOP (QoS 2)
smartwash/<branch>/<machine>/status   # uplink: telemetry   (QoS 1)
smartwash/<branch>/<machine>/lwt      # Last Will → OFFLINE detection
```
`HEARTBEAT_TIMEOUT_SEC=30` — no status for N s → Machine FSM OFFLINE → cancel/refund hook.
EMQX is **anonymous in dev**; `infra/mqtt/acl.conf` is a prod artifact — don't enable
strict authz without per-role/per-device credentials.

## Mobile app architecture (Flutter super app)

`apps/smartwash-app/` is the single Flutter super app (requires Flutter 3.27+ / Dart 3.5+).
Three modes in one login: **Customer · Driver · Staff** — role from `realm_access.roles` in JWT.
Multiple roles → `RoleSelectScreen` → instant role switching, never requires logout.

```
lib/
├── main.dart / app.dart          # Entry + router bootstrap
├── core/
│   ├── auth/                     # AuthService, JWT decode, TokenStore (flutter_secure_storage)
│   ├── api/                      # Dio client + BFF models
│   ├── config/                   # AppConfig (--dart-define values at build time)
│   └── utils/                    # formatKip, errorMapper
├── design_system/                # SwColors, SwTypography, SwButton, SwBadge, SwCard
├── router/                       # go_router with role-based shell routing
├── providers/                    # Riverpod 2.x: authProvider, activeRoleProvider
└── features/
    ├── auth/                     # LoginScreen, RoleSelectScreen
    ├── customer/                 # Home, Orders, Scan, Topup, Delivery, Notifications, Profile, OrderWizard
    ├── driver/                   # Tasks, Map (Google Maps SDK), Earnings, Profile
    └── staff/                    # Machines, Slips (slip review), Profile
```

Keycloak client: `smartwash-app`, public, OIDC, ROPC enabled.
Google Maps key required for driver map (`--dart-define=GOOGLE_MAPS_KEY=…`); without it
the map shows a placeholder — all other features work.

The legacy `apps/customer-app/` and `apps/driver-app/` (React Native/Expo SDK 54) are kept
as reference but are **being retired — do NOT add new features to the RN apps.**

## Dev commands

### Infrastructure

```bash
# copy env and set secrets (INTERNAL_SERVICE_TOKEN is required)
cp infra/.env infra/.env.local

# bring up all infra + services (schema auto-loads on first boot)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# LAN / real-device overlay (set LAN_IP first)
docker compose -f infra/docker/docker-compose.dev.yml \
               -f infra/docker/docker-compose.lan.yml up -d

# apply / re-apply migrations explicitly
DATABASE_URL=postgresql://smartwash:change_me@localhost:5432/smartwash \
  npx nx run db:migrate

# after editing infra/traefik/dynamic.yml
docker compose -f infra/docker/docker-compose.dev.yml restart traefik
```

Dev ports (host-mapped): Traefik gateway **:8088** / **:8443** · Traefik dashboard :8081 ·
Grafana :3001 · Prometheus :9090 · EMQX :18083 · MinIO console :9001 ·
Keycloak :8080 · Temporal :7233 · Postgres :5432 · Redis :6379.

App services have **no host port** — health-check them from inside the compose network:
```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T order \
  node -e "fetch('http://localhost:3003/health/ready').then(r=>r.text()).then(console.log)"
```

### NestJS services (Nx)

```bash
# lint / test everything
npx nx run-many -t lint
npx nx run-many -t test

# one service
npx nx test order
npx nx lint order
npx nx serve order           # ts-node hot reload (no Docker)

# single test file or test name
npx jest --config services/order/jest.config.ts orders.service.spec.ts
npx jest --config services/order/jest.config.ts -t "refundForError grace"

# build — TWO steps (never collapse to a single esbuild pass)
# tsc emits decorator metadata NestJS DI needs; esbuild then bundles
# see tools/build-service.mjs for details
npx nx build order
```

### FastAPI services (Python — ocr, risk)

```bash
cd services/ocr        # or services/risk
pip install ".[dev]"
uvicorn app.main:app --reload   # dev server
python -m pytest -q             # tests
ruff check .                    # lint
```

### Flutter super app

```bash
cd apps/smartwash-app
flutter pub get

# Android emulator
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:8088/api \
  --dart-define=KEYCLOAK_URL=http://10.0.2.2:8080

# iOS simulator
flutter run \
  --dart-define=API_BASE_URL=http://127.0.0.1:8088/api \
  --dart-define=KEYCLOAK_URL=http://127.0.0.1:8080

# Physical device (set LAN_IP in docker-compose.lan.yml first)
flutter run \
  --dart-define=API_BASE_URL=http://<LAN_IP>:8088/api \
  --dart-define=KEYCLOAK_URL=http://<LAN_IP>:8080 \
  --dart-define=GOOGLE_MAPS_KEY=<key>

# Nx shortcuts
npx nx serve smartwash-app    # flutter run
npx nx build smartwash-app    # flutter build apk
npx nx test smartwash-app     # flutter test
npx nx lint smartwash-app     # flutter analyze
```

### Web portals (React + Vite)

```bash
# one-time: add hosts entry as Administrator
Add-Content C:\Windows\System32\drivers\etc\hosts "127.0.0.1 keycloak"

cd apps/owner-portal   # or apps/admin-portal
npm run dev            # Vite on :5173 / :5174
```

Dev users: `205550{1..4}001` / `dev-pass-<phone>` (customer/driver/owner/admin).
Tokens must be minted **inside** the compose network (issuer = `http://keycloak:8080/...`);
tokens minted via `localhost:8080` carry the wrong issuer and are rejected.

### CI pipeline

`.github/workflows/ci.yml`: lint → migrate → unit+integration tests → OpenAPI+event schema
validation → (on `main`) Docker image builds. FastAPI services (ocr, risk) run a separate
`python-test` job with `pytest`.

### Load tests

```bash
k6 run tools/k6/smoke.js
K6_TOKEN=<jwt> k6 run tools/k6/topup.js
K6_TOKEN=<jwt> BRANCH_ID=<uuid> MACHINE_ID=<uuid> k6 run tools/k6/wash.js
```

## Key env vars

| Variable | Purpose |
|---|---|
| `INTERNAL_SERVICE_TOKEN` | Shared secret for `X-Internal-Token`; fail-closed if unset |
| `OWNER_ACCOUNT` | Bank account the Owner QR pays into (e.g. `OWNER-ACC-0001`) |
| `STAFF_REVIEW_TIMEOUT_MS` | Manual topup review window before auto-reject (default 24h) |
| `WASH_REFUND_ON_ERROR` | `grace_pro_rata` / `pro_rata` / `full` |
| `WASH_REFUND_GRACE_PCT` | Below this % progress → full refund (default 20) |
| `SIM_DEVICES` | JSON array of machines for `device-sim` to emulate |
| `HEARTBEAT_TIMEOUT_SEC` | Machine MQTT silence before FSM → OFFLINE (default 30) |

See `infra/.env.example` for the full list.

## DB migrations

Scripts in `infra/db/init/` apply in numeric order on first `docker compose up`.
Current: `01_schema.sql` · `02_rbac_seed.sql` · `03_user_roles_nullable_branch.sql` ·
`04_ratings_addresses_notif.sql`. **Always review migrations by hand before running.**
New scripts go as `05_…`, `06_…`, etc.

## Gotchas

- **Docker Desktop DNS** can be flaky right after start — re-run `docker compose up -d --build`; progress is cached.
- **Traefik** doesn't pick up `dynamic.yml` changes through Windows bind mounts → `docker compose restart traefik`.
- **Temporal `auto-setup`** shares the Postgres instance and creates its own DBs on first boot — give it a few seconds.
- **Startup error logs are normal** until NATS/Temporal/EMQX are reachable; outbox relays, saga worker, and MQTT bridge retry automatically.
- **No seed data / Keycloak realm** → 401s everywhere. Run `docs/RUNBOOK.md §3` first.
- EMQX is **anonymous in dev**; don't enable strict ACL without per-device credentials.

---

## Global Engineering Policy

### Mission

Build and maintain SmartWash as a production-ready Flutter Super App with exceptional user experience, startup performance, maintainability, security, scalability, and code quality.

Mobile: ONE Super App — Customer · Driver · Staff.
Web: Branch Owner Portal · Admin Portal.

Always prioritize long-term quality over short-term speed.

### Mandatory Workflow

For every task, follow this order — **never skip to implementation**:

1. Audit
2. Analyze
3. Report Findings
4. Reuse Existing Code
5. Extend Existing Code
6. Refactor Shared Logic
7. Implement Only Missing Functionality
8. Verify
9. Document

### Audit First

Before creating, modifying, replacing, refactoring, or deleting anything:

- Inspect the repository thoroughly.
- Search for equivalent functionality.
- Confirm whether similar logic already exists.
- Reuse existing code whenever possible.
- Refactor duplicated code into shared modules.
- Create new code only when genuinely necessary.

Never duplicate: Screens, Widgets, Components, Services, Repositories, Models, API clients, Utilities, Business logic.

### Super App Architecture

Maintain ONE Flutter mobile application. Roles: Customer · Driver · Staff.

Shared across all roles: Authentication, Login, Session, Profile, Settings, Notifications, Theme, Localization, Networking, Shared widgets, Shared services, Design system.

Support multiple roles per account. Allow instant role switching without logout. Reuse the same authenticated session.

Create separate role implementations only when business requirements genuinely demand it.

### Fast Startup (highest priority)

- **Auto Login** — skip the Login screen if a valid session exists; restore silently.
- **Instant Role Restore** — remember last active role, open directly into it, restore last branch and preferences.
- **Background Loading** — load non-critical data (notifications, reports, analytics, images, history, background sync, optional settings) without blocking first interaction.

Optimize: startup latency, memory usage, API calls, widget rebuilds, CPU usage, battery usage.

### Premium UI/UX

Every screen must be production-ready. Verify per screen:

Responsive layout · Accessibility · Consistent spacing · Typography · Visual hierarchy · Loading / Empty / Success / Error / Offline states · Smooth transitions · Design system compliance · Navigation correctness · Permission enforcement

Avoid: placeholder pages, broken layouts, inconsistent styling, duplicate components.

### RBAC

Enforce RBAC everywhere. Never rely only on hidden UI. Validate permissions server-side for all roles. Update permissions immediately after role switching.

### Cleanup Policy

Before deleting anything, check all references (imports, routing, DI, config, build scripts, runtime usage, feature flags).

Classify every file/module:
- **ACTIVE** — used in production → Keep
- **SHARED** — used by multiple modules → Keep
- **FUTURE** — reserved for planned features → Keep (document planned purpose)
- **LEGACY** — retained for compatibility → Keep unless safely migrated
- **DUPLICATE** — can be consolidated → consolidate first, then remove redundant copy
- **DEAD_CODE** — verified safe for removal → remove after documenting evidence
- **UNKNOWN** — usage unclear → **NEVER delete automatically**

When uncertain → **KEEP**. Mark, document, include in cleanup report, request manual review.

Never auto-delete: Authentication, RBAC, payment logic, notifications, loyalty, coupons, membership, i18n, offline support, analytics, audit logs, AI modules, IoT integrations, branch/franchise/machine features, migrations, environment config, routing, DI setup, CI/CD config — unless explicitly verified obsolete.

### Future-Proofing

Preserve extension points for: Loyalty, Membership, Coupons, Wallet, AI, Analytics, Settlement, Franchise, Multi-Branch, Multi-Language, Multi-Currency, IoT, Smart Machines, Push Notifications, Email, SMS, Promotions, Audit Logs, Offline Mode.

Never remove extension points unnecessarily.

### API Policy

Search existing endpoints before creating new ones. Reuse repositories and clients. Prevent duplicate requests. Support retries and timeouts. Cache responsibly. Prefer extension over replacement.

### Database Policy

Protect: User accounts, Orders, History, Settlement, Audit records.

Avoid destructive schema changes. Require documented migration plans. Prefer backward-compatible evolution. (See also: non-negotiable rules #2 and #3 above — append-only ledger, idempotency keys.)

### Performance

Prefer: lazy loading, smart caching, pagination, incremental loading, background processing.

Avoid: blocking startup, duplicate API calls, unnecessary widget rebuilds, expensive synchronous operations, memory leaks.

### Security

Never expose: Passwords, Tokens, Secrets, API keys, Credentials.

Validate authorization server-side. Apply least privilege. Protect sensitive information.

### Evidence-Based Changes

Before major changes: identify the existing implementation, explain why the change is needed, confirm no equivalent exists, estimate benefits and risks, document rollback strategy if applicable.

Never refactor purely for preference.

### Production Gate

No task is complete until:
- ✓ Existing code audited
- ✓ Existing implementation reused where appropriate
- ✓ Duplicate logic avoided
- ✓ Backward compatibility preserved
- ✓ RBAC verified
- ✓ Navigation verified
- ✓ Startup performance maintained or improved
- ✓ Security maintained
- ✓ Documentation updated
- ✓ Project builds successfully
- ✓ Production-ready quality achieved

### Priority Order

1. Stability
2. Security
3. Startup Speed
4. User Experience
5. Code Reuse
6. Backward Compatibility
7. Maintainability
8. Scalability
9. Performance
10. Long-term evolution of the SmartWash Super App

**Final Rule:** If uncertain — STOP. Do not delete. Do not rewrite. Do not duplicate.
Audit → Analyze → Report → Reuse → Extend → Refactor → Implement only what is missing → Verify → Document.
