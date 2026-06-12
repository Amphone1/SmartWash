# SmartWash v5 — ລາຍງານດ້ານເທັກນິກ

> ສ້າງວັນທີ: 2026-06-11 | Branch: main | Phase: 1 (Identity + Core) ສຳເລັດ; phase 2–5 ໄດ້ scaffold ແລ້ວ

---

## 1. ພາບລວມຂອງສະຖາປັດຕະຍະກຳ

SmartWash ແມ່ນ platform ຊັກຜ້າລະດັບອົງກອນ ແບບ multi-tenant ສຳລັບລາວ ທີ່ສ້າງຂຶ້ນເປັນ **Nx monorepo** ຂອງ microservices, ແອັບມືຖືສອງຕົວ, web portal ສອງຕົວ, ແລະຊຸດ library ທີ່ໃຊ້ຮ່ວມກັນ. ສະຖາປັດຕະຍະກຳດຳເນີນງານໂດຍໃຊ້ event-driven, ຄຸ້ມຄອງດ້ວຍ saga, ແລະເຊື່ອມຕໍ່ກັບ IoT.

### ໂຄງສ້າງລະດັບສູງ

```
Mobile (React Native)          Web (React+Vite)
  customer-app  driver-app      owner-portal  admin-portal
         │              │              │             │
         └──────────────┴──────────────┴─────────────┘
                               │
                         Traefik Gateway
                    /api/bff  /api/auth  (ເປີດໃຫ້ໃຊ້ພຽງສອງເສັ້ນທາງນີ້)
                               │
                    ┌──────────┴──────────┐
                   BFF (NestJS)        Auth (NestJS+Keycloak)
                    │
         ┌──────────┼──────────────────────────────────────┐
         │          │          │          │                 │
       Order     Payment    Ledger    Machine    Delivery / GPS
       Queue      Fraud      Wallet   (MQTT↔EMQX)  Settlement
        RBAC       OCR       Risk       Saga       Reconciliation
       Audit    Notification                        (+ ອື່ນໆ)
         │          │          │          │                 │
         └──────────┴──────────┴──────────┴─────────────────┘
                               │
              PostgreSQL+TimescaleDB  Redis  NATS JetStream  MinIO
```

- **Traefik v3.1** ເປັນ edge ສາທາລະນະພຽງຕົວດຽວ. ມີແຕ່ `/api/bff` ແລະ `/api/auth` ເທົ່ານັ້ນທີ່ຖືກ route. service ອື່ນທັງໝົດຖືກ isolate ທາງ network ແລະເຂົ້າເຖິງໄດ້ຜ່ານ BFF ດ້ວຍ secret `X-Internal-Token` ທີ່ໃຊ້ຮ່ວມກັນເທົ່ານັ້ນ.
- **BFF** (Backend-For-Frontend) ລວບລວມການເອີ້ນໃຊ້ service ລຸ່ມເທິງແທນແອັບ, ບັງຄັບໃຊ້ bearer-token auth ຜ່ານ Keycloak introspection, ແລະກວດສອບ RBAC ຄືນກ່ອນສົ່ງຕໍ່.
- **NATS JetStream** ເປັນ event bus ແບບ async. service ຕ່າງໆຂຽນຂໍ້ມູນໃສ່ຕາຕະລາງ `outbox` ໃນ DB transaction ດຽວກັນກັບ domain row, ຈາກນັ້ນ `OutboxRelay` ຂອງແຕ່ລະ service ຈະ poll ແລະ publish — ຮັບປະກັນການສົ່ງ event ແບບ exactly-once ພາຍໃນຂອບເຂດ transaction ແຕ່ລະຄັ້ງ.
- **Temporal** ໃຊ້ສຳລັບ saga ຫຼາຍຂັ້ນຕອນເທົ່ານັ້ນ (`wash_order`, `topup`, `delivery_order`). ບໍ່ມີການ orchestrate ແບບອື່ນ.
- **EMQX** ເປັນ MQTT broker ສຳລັບ device controller WISE-4051. Machine service subscribe ກັບ `smartwash/+/+/status` ແລະ `smartwash/+/+/lwt`.

---

## 2. ໂຄງສ້າງ Frontend / App

### 2.1 Customer App (`apps/customer-app` — React Native / Expo)

**ສະຖານະປັດຈຸບັນ (Phase 1):** flow ຂັ້ນຕໍ່າສຸດ — ວາງ bearer token → ເລືອກປະເພດ service → ລາຍຊື່ສາຂາ → ລາຍຊື່ເຄື່ອງ.

| ໜ້າຈໍ | ຄຳອະທິບາຍ |
|--------|-------------|
| `token` | ຊ່ອງວາງ token ດິບ (ຍັງບໍ່ມີ Keycloak SSO) |
| `service` | ຕົວເລືອກປະເພດ service: self-service / pickup / delivery |
| `branches` | `GET /bff/branches` — ລາຍຊື່ສາຂາທີ່ເປີດ |
| `machines` | `GET /bff/branches/:id/machines` — ລາຍຊື່ເຄື່ອງພ້ອມສະຖານະ + ລາຄາ |

State ຄຸ້ມຄອງດ້ວຍ React `useState` ທຳມະດາ; ບໍ່ມີ navigation library. ເປົ້າໝາຍ phase ທັງໝົດລວມມີ: ເຕີມເງິນ wallet, ສະແກນ QR, ສ້າງ order, ສະຖານະການຊັກແບບ real-time, ຕິດຕາມການຈັດສົ່ງ, ກ່ອງ notification.

### 2.2 Driver App (`apps/driver-app` — React Native / Expo)

**ສະຖານະປັດຈຸບັນ (Phase 4 skeleton):** ລາຍຊື່ delivery ທີ່ໄດ້ຮັບມອບໝາຍ, ຮັບ/ປະຕິເສດ, ກ້າວໄປຕາມສະຖານະ delivery FSM, ລາຍງານທີ່ຕັ້ງ GPS.

state machine ຂອງ delivery ສະແດງທາງຝ່າຍ client ຜ່ານຕາຕະລາງ `NEXT`:
`ACCEPTED → EN_ROUTE_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED → (Complete)`

### 2.3 Owner Portal (`apps/owner-portal` — React + Vite)

**ສະຖານະປັດຈຸບັນ (Phase 5 skeleton):** dashboard KPI card ດຽວ — ລາຍຮັບມື້ນີ້, ຈຳນວນ order ມື້ນີ້, ອັດຕາການໃຊ້ງານເຄື່ອງ. ອ່ານຂໍ້ມູນຈາກ `GET /bff/owner/summary`.

### 2.4 Admin Portal (`apps/admin-portal` — React + Vite)

**ສະຖານະປັດຈຸບັນ (Phase 5 skeleton):** ຕາລາງ KPI ທົ່ວທັງລະບົບ + ຕາຕະລາງການ run reconciliation. ອ່ານຂໍ້ມູນຈາກ `GET /bff/admin/summary` ແລະ `GET /bff/admin/reconciliation`.

ໜ້າສັງເກດ: ຄວາມຜິດປົກກະຕິໃນ reconciliation (review/suspicious/orphan) ສະແດງສີ amber/ແດງ. admin ສາມາດ trigger ການ run reconciliation ໄດ້ຜ່ານ `POST /bff/admin/reconciliation/run`.

---

## 3. ລາຍການ Backend Service

| Service | ພາສາ | Port | ໜ້າທີ່ |
|---------|----------|------|---------------|
| `auth` | NestJS | 3001 | Keycloak adapter: `/auth/me`, `/auth/introspect` |
| `rbac` | NestJS | 3002 | ຊອກຫານະໂຍບາຍ: `POST /rbac/check`, `GET /rbac/users/:id/permissions` |
| `order` | NestJS | 3003 | Order FSM, order_events; NATS outbox |
| `queue` | NestJS | 3004 | Queue entries, reservation TTL |
| `bff` | NestJS | 3005 | ລວບລວມ API, gateway ສຳລັບ auth/RBAC |
| `wallet` | NestJS | 3006 | cache ຍອດເງິນ wallet |
| `ledger` | NestJS | 3007 | ledger append-only; ການ post ແບບ atomic ດ້ວຍ advisory lock |
| `fraud` | NestJS | 3008 | dedup slip + ການປະເມີນກົດ |
| `payment` | NestJS | 3009 | payment requests, ອັບໂຫລດ slip, QR, FSM |
| `machine` | NestJS | 3010 | Machine FSM, MQTT bridge, heartbeat sweep |
| `delivery` | NestJS | 3012 | Delivery FSM, ຄຳນວນຄ່າໂດຍ Haversine/Maps |
| `gps` | NestJS | 3013 | ຮັບຂໍ້ມູນ GPS + fanout ຜ່ານ WS |
| `settlement` | NestJS | 3014 | settlement ລາຍວັນ, ຈ່າຍ driver |
| `reconciliation` | NestJS | 3015 | ກວດສອບໃບແຈ້ງໜີ້ທະນາຄານ |
| `notification` | NestJS | 3016 | ສົ່ງ Push/WS/email/SMS |
| `audit` | NestJS | 3017 | audit_log append-only ຜ່ານ endpoint ພາຍໃນ |
| `saga` | Temporal worker | — | workflow ສຳລັບ `topup`, `wash_order`, `delivery_order` |
| `ocr` | FastAPI (Python) | 8001 | ອ່ານ slip ດ້ວຍ PaddleOCR |
| `risk` | FastAPI (Python) | 8002 | ໃຫ້ຄະແນນຄວາມສ່ຽງດ້ວຍກົດ (ML ເລື່ອນໄປກ່ອນ) |
| `device-sim` | NestJS | — | MQTT device simulator ສຳລັບ dev/test |

### ໂຄງສ້າງ hexagonal ພາຍໃນແຕ່ລະ service (NestJS)

```
src/
  api/          ← controllers + DTOs (ຊ່ວງກວດສອບຂໍ້ມູນ)
  domain/       ← entities, value objects, FSMs (logic ບໍລິສຸດ)
  application/  ← use-case services (commands + event handlers)
  infra/
    db/         ← pg repositories
    events/     ← NATS publishers/consumers, outbox relay
    external/   ← HTTP clients (OCR, MinIO, ແລະອື່ນໆ)
  config/
  health/       ← /health/live, /health/ready, /metrics
```

---

## 4. ການໄຫຼຂອງ API

### 4.1 ໜ້າຜິວ API ສາທາລະນະ (ຜ່ານ Traefik)

ການສັນຈອນຂອງ client ທັງໝົດເຂົ້າທາງ port 8088 (HTTP) ຫຼື 8443 (HTTPS). Traefik ໃຊ້ rate limit IP ຫຍາບໆ (ສະເລ່ຍ 100 req/ນາທີ, burst 50) ແລ້ວ route ໄປ:

| ເສັ້ນທາງສາທາລະນະ | Service |
|-------------|---------|
| `/api/bff/**` | BFF service |
| `/api/auth/**` | Auth service |

service ອື່ນທັງໝົດ **ບໍ່ສາມາດເຂົ້າເຖິງໄດ້ຈາກພາຍນອກ**.

### 4.2 ແຜນທີ່ route ຂອງ BFF

```
GET  /bff/branches                      → catalog: ລາຍຊື່ສາຂາ
GET  /bff/branches/:branchId/machines   → catalog: ເຄື່ອງ + ສະຖານະ

POST /bff/orders                        → order: ສ້າງ order
GET  /bff/orders/:id                    → order: ເບິ່ງ order
POST /bff/orders/:id/start              → ກະຕຸ້ນ saga: ເລີ່ມຊັກ
POST /bff/orders/:id/request-delivery   → order + delivery: ເລີ່ມຈັດສົ່ງ

POST /bff/queues/:machineId/join        → queue: ເຂົ້າຄິວ

POST /bff/payments                      → payment: ສ້າງ QR
POST /bff/payments/:qrRef/slip          → payment: ອັບໂຫລດ slip (ກະຕຸ້ນ topup saga)
GET  /bff/payments/:qrRef               → payment: ກວດສອບສະຖານະ
GET  /bff/wallet                        → wallet: ຍອດເງິນ
GET  /bff/notifications                 → notification: ກ່ອງຂໍ້ຄວາມ

GET  /bff/deliveries/:id                → delivery: ເບິ່ງ delivery
GET  /bff/deliveries/:id/track          → GPS: ຕິດຕາມ live

POST /bff/driver/deliveries/:id/accept  → delivery: driver ຮັບ
POST /bff/driver/deliveries/:id/reject  → delivery: driver ປະຕິເສດ
POST /bff/driver/deliveries/:id/advance → delivery: ກ້າວ FSM ໄປໜ້າ
POST /bff/driver/deliveries/:id/complete→ delivery: ສຳເລັດ
POST /bff/driver/location               → GPS: ລາຍງານທີ່ຕັ້ງ

GET  /bff/owner/summary                 → reporting: ສະຫຼຸບ KPI
GET  /bff/owner/settlements             → reporting: ລາຍຊື່ settlement
GET  /bff/admin/summary                 → reporting: ສະຫຼຸບ ops
GET  /bff/admin/reconciliation          → reporting: ການ run reconciliation
GET  /bff/admin/audit                   → audit: ບັນທຶກ audit
POST /bff/admin/settlements/run         → settlement: run
POST /bff/admin/reconciliation/run      → reconciliation: run
```

### 4.3 ຂັ້ນຕອນ Topup (Payment chain)

```
ລູກຄ້າ             BFF              Payment       OCR       Risk      Fraud     Ledger     Temporal
   │──POST /bff/payments──►│                │                                                       │
   │                       │──POST /payments►│                                                       │
   │                       │                │ ສ້າງ payment_request, qr_ref                          │
   │◄── { qrRef, qrPayload }──│                │                                                       │
   │                       │                │                                                       │
   │──POST /bff/payments/:qrRef/slip──►│                                                             │
   │   (Idempotency-Key, ຮູບ slip)      │──POST /payments/:qrRef/slip►│                              │
   │                                   │                │ SHA-256 hash, ເກັບຮູບໃນ MinIO              │
   │                                   │                │──────────────────────── ເລີ່ມ topup workflow ►│
   │                                   │                │                                 │(topupWorkflow)│
   │                                   │                │              │◄──ocrParse──│    │               │
   │                                   │                │              │──ຜົນ ocr───►│    │               │
   │                                   │                │                       │◄──riskScore──│          │
   │                                   │                │                              │◄──fraudEvaluate──│
   │                                   │                │◄──applyDecision────────────────────────────│    │
   │                                   │                │                                            │    │
   │                                   │                │◄──postLedgerTopup (TOPUP, idempotent)───────────►│
   │                                   │                │                                                  │
   │◄──GET /bff/payments/:qrRef (poll)──│──►│                                                              │
   │        { state: APPROVED }         │                │                                                  │
```

### 4.4 ຂັ້ນຕອນ Wash order (wash_order saga)

```
Order ສ້າງແລ້ວ (state=CREATED, RESERVED)
    │
    ▼
POST /bff/orders/:id/start
    │
    ▼ [Temporal washOrderWorkflow]
1. machineReserve   → Redis SETNX lock + Machine=RESERVED
2. walletBalance    → ກວດຍອດເງິນ (ກວດເບື້ອງຕົ້ນ)
3. deductWallet     → Ledger DEDUCT (pg advisory lock, idempotent) → Order=PAID
4. machineStart     → MQTT publish smartwash/{branch}/{machine}/cmd
5. ລໍຖ້າ signal 'running' (MachineRunning event ຜ່ານ NATS → saga signal)
   → Order=RUNNING
6. ລໍຖ້າ signal 'finished' (MachineFinished / timeout / error / offline)
   → ຖ້າ error/timeout: ຄືນເງິນ pro-rata + Order=REFUNDED
   → ຖ້າສຳເລັດ: Order=COMPLETED + ປ່ອຍ lock
```

---

## 5. ການອອກແບບຖານຂໍ້ມູນ

### ເຄື່ອງຈັກ
PostgreSQL 16 + TimescaleDB, ໃຊ້ image `timescale/timescaledb:latest-pg16`.

### ຈຸດເດັ່ນຂອງ Schema

Schema ໃຊ້:
- **UUID PKs** (`gen_random_uuid()`) ໃນທຸກຕາຕະລາງ domain
- **BIGINT ສຳລັບເງິນທັງໝົດ** ໃນກີບ — ບໍ່ມີ NUMERIC, DECIMAL, ຫຼື float
- **`TIMESTAMPTZ` ທຸກທີ່** — UTC ຕະຫຼອດ
- **PostgreSQL ENUMs** ສຳລັບ state machine ທັງໝົດ (ບັງຄັບທີ່ layer ຂອງ DB)
- **ຕາຕະລາງ append-only**: `ledger_entries`, `order_events`, `machine_events`, `audit_log` — ຫ້າມ UPDATE/DELETE

### ກຸ່ມ entity ຫຼັກ

**Identity & RBAC**
- `users` → `user_roles` (ຂອບເຂດສາຂາ) → `roles` → `role_permissions` → `permissions`
- `branches` (lat/lng, ເວລາເປີດ/ປິດ, owner_account)
- `drivers` (ເຊື່ອມກັບ users, ຂອບເຂດສາຂາ, state FSM)

**ເຄື່ອງຈັກ**
- `machines` (code, type, capacity_kg, price BIGINT)
- `machine_status` (1 row ຕໍ່ເຄື່ອງ, snapshot real-time ອັບເດດໂດຍ Machine service)
- `machine_events` (ປະຫວັດ telemetry append-only)

**Orders & Queue**
- `orders` (type, state, cycle, addons JSONB, subtotal/vat/total BIGINT)
- `order_events` (ບັນທຶກ FSM append-only ສຳລັບ audit)
- `queue_entries` (position, called_at, expires_at)

**Payment & Finance**
- `payment_requests` (qr_ref UNIQUE, amount_expected BIGINT, expires_at)
- `slips` (slip_hash SHA-256 UNIQUE — dedup fraud ລະດັບ DB, ocr_json JSONB)
- `wallets` (balance BIGINT — **cache ເທົ່ານັ້ນ**; ແຫຼ່ງຄວາມຈິງ = ledger)
- `ledger_entries` (**APPEND-ONLY**: type TOPUP/DEDUCT/REFUND_REVERSAL/ADJUSTMENT, amount ເປັນ signed BIGINT, balance_after BIGINT, idempotency_key UNIQUE)
- `risk_scores` (score 0-100, factors JSONB, time-series)
- `refunds` (ອ້າງອີງ ledger_entries.id — ປິດຊ່ອງຫວ່າງ audit)

**Finance / Ops**
- `settlements` + `settlement_lines` (settlement ລາຍວັນຕໍ່ສາຂາ, ຈ່າຍ driver)
- `reconciliation_runs` + `bank_statement_lines` (ກວດສອບ CSV ທະນາຄານ)

**Delivery & GPS**
- `deliveries` (state FSM, ພິກັດ pickup/dropoff, fee BIGINT)
- `driver_locations` (ping ປະລິມານສູງ — ເໝາະຈະເປັນ TimescaleDB hypertable)

**Reliability**
- `outbox` (state PENDING/PUBLISHED/FAILED, deduplication ສຳລັບ relay)
- `idempotency_keys` (ເກັບຄົງຕໍ່ operation — dedup replays)
- `saga_instances` (ຕິດຕາມ Temporal workflow)
- `audit_log` (ຜູ້ດຳເນີນການ, action, entity, before/after JSON, IP)

### Index ສຳຄັນ

| ຕາຕະລາງ | Index | ຈຸດປະສົງ |
|-------|-------|---------|
| `machine_status` | `(branch_id, state)` | ຊອກຫາຄວາມພ້ອມໃຊ້ງານຂອງເຄື່ອງ |
| `orders` | `(user_id, created_at DESC)` | ເລື່ອນໜ້າປະຫວັດ order |
| `ledger_entries` | `(user_id, created_at DESC)` | ປະຫວັດຍອດເງິນ |
| `outbox` | `(created_at) WHERE state='PENDING'` | polling ຂອງ relay — partial index |
| `saga_instances` | `(state) WHERE state IN (RUNNING, COMPENSATING)` | ຕິດຕາມ saga ທີ່ດຳເນີນຢູ່ |
| `queue_entries` | `(machine_id, position) WHERE status='IN_QUEUE'` | ຈັດລຳດັບຄິວ |

---

## 6. ສະຫຼຸບ Routes ແລະໜ້າຈໍ

### Customer App (React Native)
| ຂັ້ນຕອນ | ສິ່ງທີ່ເກີດຂຶ້ນ |
|------|-------------|
| ໃສ່ token | bearer token ດິບ (Phase 1 placeholder) |
| ເລືອກ service | `self_service` / `pickup` / `delivery` |
| ລາຍຊື່ສາຂາ | `GET /bff/branches` |
| ລາຍຊື່ເຄື່ອງ | `GET /bff/branches/:id/machines` |
| *(ວາງແຜນ)* | QR ເຕີມເງິນ, ສ້າງ order, ສະຖານະຊັກ, ແຜນທີ່ delivery, ສູນ notification |

### Driver App (React Native)
| ການກະທຳ | API call |
|--------|---------|
| ໂຫລດ delivery | `GET /bff/driver/deliveries` |
| ຮັບ | `POST /bff/driver/deliveries/:id/accept` |
| ປະຕິເສດ | `POST /bff/driver/deliveries/:id/reject` |
| ກ້າວ FSM | `POST /bff/driver/deliveries/:id/advance` |
| ສຳເລັດ | `POST /bff/driver/deliveries/:id/complete` |
| ລາຍງານທີ່ຕັ້ງ | `POST /bff/driver/location` |

### Owner Portal (React + Vite)
| ມຸມມອງ | ແຫຼ່ງຂໍ້ມູນ |
|------|------------|
| KPI dashboard | `GET /bff/owner/summary` |
| ລາຍຊື່ settlement | `GET /bff/owner/settlements` |

### Admin Portal (React + Vite)
| ມຸມມອງ | ແຫຼ່ງຂໍ້ມູນ |
|------|------------|
| KPI ops | `GET /bff/admin/summary` |
| ຕາຕະລາງ reconciliation | `GET /bff/admin/reconciliation` |
| ບັນທຶກ audit | `GET /bff/admin/audit` |
| Trigger settlement | `POST /bff/admin/settlements/run` |
| Trigger reconciliation | `POST /bff/admin/reconciliation/run` |

---

## 7. ການວິເຄາະດ້ານຄວາມປອດໄພ

### ຈຸດແຂງ

| ມາດຕະການ | ການຈັດຕັ້ງປະຕິບັດ |
|---------|---------------|
| Network isolation | BFF+Auth ເທົ່ານັ້ນທີ່ເປີດຜ່ານ Traefik; service ອື່ນຊ່ອນຢູ່ໃນ Docker internal network |
| Bearer token auth | Keycloak JWT introspection ທຸກຄຳຮ້ອງຂໍ BFF ຜ່ານ `BffAuthGuard` |
| RBAC ລະດັບເລິກ | ບັງຄັບທີ່ BFF (`PermissionsGuard`) **ແລະ** ກວດສອບຄືນພາຍໃນ service (`RbacGuard`) — ບໍ່ມີ layer ໃດໄວ້ວາງໃຈ layer ອື່ນ |
| Auth service-to-service ພາຍໃນ | `InternalTokenGuard` ໃຊ້ `timingSafeEqual` (ການປຽບທຽບ constant-time) — ປິດ fail-closed ຖ້າ `INTERNAL_SERVICE_TOKEN` ບໍ່ໄດ້ຕັ້ງ |
| Idempotency | header `Idempotency-Key` ຕ້ອງການສຳລັບ POST ທີ່ປ່ຽນ state ທຸກຕົວ; ເກັບໃສ່ `idempotency_keys`; ປ້ອງກັນການເກັບເງິນຊ້ຳ |
| Fraud dedup | `slips.slip_hash` (SHA-256) ເປັນ constraint UNIQUE ລະດັບ DB — slip ທີ່ອັບໂຫລດຊ້ຳຈະ fail ກ່ອນ logic ທຸລະກິດທຳງານ |
| Rate limiting | ສອງ layer: Traefik ຈຳກັດ IP ຫຍາບໆ (100/ນາທີ) + NestKit `RateLimitGuard` ຕໍ່ route/user ຜ່ານ Redis fixed-window |
| ຄວາມຊື່ສັດຂອງ ledger | append-only ດ້ວຍ `pg_advisory_xact_lock` ຕໍ່ user — ບໍ່ມີ race ຍອດເງິນ concurrent; overdraft guard ໃນ repository |
| ຄວາມປອດໄພຂອງປະເພດເງິນ | primitive `Kip = bigint`; `toKip()` ປະຕິເສດ fraction/NaN ທີ່ຂອບ — float ບໍ່ສາມາດເຂົ້າ ledger path ໄດ້ |
| MQTT ACLs | EMQX ACL ບັງຄັບ role backend vs device; deny ໂດຍ default |

### ຈຸດອ່ອນ ແລະ ຊ່ອງຫວ່າງ

#### ສູງ — Secrets ໃນ `infra/.env` ຖືກ commit ໃສ່ repository
**ທີ່ພົບ:** `infra/.env` ມີລະຫັດຜ່ານ default (`change_me`, `change_me_internal`) ທີ່ຖືກ commit ເຂົ້າ version control. ເຖິງວ່າຈະເປັນ string placeholder, ແຕ່ format ຂອງໄຟລ໌ ແລະ ຄ່າຕົວຈິງຈະມົ່ວເຫັນໄດ້ຖ້າຜູ້ຮ່ວມໂຄງການ copy ໂດຍບໍ່ໄດ້ປ່ຽນ.
**ຄວາມສ່ຽງ:** ຖ້າ credentials ຈິງລົງໄຟລ໌ນີ້, ມັນຈະຢູ່ໃນປະຫວັດ git ທັນທີ. ໄຟລ໌ນີ້ບໍ່ຄວນຖືກ track.
**ຂໍ້ສະເໜີ:** ເພີ່ມ `infra/.env` ໃສ່ `.gitignore`; ໃຊ້ `infra/.env.example` (ມີຢູ່ແລ້ວ) ເປັນ template ທີ່ commit ໄດ້ພຽງຕົວດຽວ; rotate ທຸກ secret ກ່ອນ deploy ທຸກ environment ທີ່ບໍ່ແມ່ນ local.

#### ສູງ — `INTERNAL_SERVICE_TOKEN` ເປັນ secret ທີ່ໃຊ້ຮ່ວມກັນຕົວດຽວ
**ທີ່ພົບ:** service NestJS 17 ຕົວ ແລະ saga worker ທັງໝົດໃຊ້ token ດຽວກັນ (`change_me_internal`). service ທີ່ຖືກ compromise ສາມາດເອີ້ນ endpoint ພາຍໃນຂອງ service ໃດກໍໄດ້.
**ຄວາມສ່ຽງ:** ບໍ່ມີ identity service-to-service; ຜົນກະທົບຂອງ service ດຽວທີ່ຖືກ compromise ແຜ່ໄປທົ່ວ backend ທັງໝົດ.
**ຂໍ້ສະເໜີ:** ໃຊ້ mTLS ຫຼື certificate SPIFFE/X.509 ຕໍ່ service (ຜ່ານ SPIRE ຫຼື k3s cert-manager) ສຳລັບ production. secret ທີ່ໃຊ້ຮ່ວມກັນຕົວດຽວຍັງຍອມຮັບໄດ້ສຳລັບ dev ແຕ່ຕ້ອງປ່ຽນກ່ອນ deploy production ແບບ multi-tenant.

#### ປານກາງ — MQTT devices ໃຊ້ credentials ດຽວກັນ
**ທີ່ພົບ:** ອຸປະກອນ WISE-4051 ທັງໝົດ authenticate ກັບ EMQX ດ້ວຍ `MQTT_USERNAME=device` (credentials ທີ່ໃຊ້ຮ່ວມກັນ). comment ໃນ ACL ລະບຸວ່າຄວນ harden ຕໍ່ device ໃນ production ແຕ່ຍັງບໍ່ໄດ້ດຳເນີນການ.
**ຄວາມສ່ຽງ:** ອຸປະກອນທີ່ຖືກ compromise ສາມາດ publish telemetry ຫຼື Last Will messages ສຳລັບເຄື່ອງໃດກໍໄດ້ ເຊິ່ງອາດ manipulate Machine FSM ຂອງເຄື່ອງທີ່ບໍ່ແມ່ນຂອງຕົນ.
**ຂໍ້ສະເໜີ:** ອອກ credentials ຕໍ່ device ໂດຍໃຊ້ `clientid` ເປັນ key ແລະ scope ACL ດ້ວຍ placeholder `${clientid}` ຕາມທີ່ອະທິບາຍໃນ `infra/mqtt/acl.conf`.

#### ປານກາງ — Customer app ເກັບ bearer token ໃນ component state ທຳມະດາ
**ທີ່ພົບ:** `customer-app/App.tsx` ເກັບ JWT ໃນ `useState('token')`. React Native ບໍ່ persist ສິ່ງນີ້, ແຕ່ບໍ່ມີການໃຊ້ Secure Storage (`expo-secure-store`), ແລະ flow Phase 1 ຮຽກຮ້ອງໃຫ້ user ວາງ token ດ້ວຍຕົນເອງ.
**ຄວາມສ່ຽງ:** token ບໍ່ຄ່ອຍໄດ້ເຂົ້າ secure storage; log/crash reports ອາດຈັບໄດ້. ທີ່ສຳຄັນກວ່ານັ້ນ, flow ປັດຈຸບັນບໍ່ມີ OAuth login ຈິງ — user ວາງ JWT ດິບ.
**ຂໍ້ສະເໜີ:** ເຊື່ອມ Keycloak PKCE flow ຜ່ານ `expo-auth-session`; ເກັບຄູ່ token refresh ໃນ `expo-secure-store`; ຢ່າ log ຫຼື display ຄ່າ token ເລີຍ.

#### ປານກາງ — BFF ສົ່ງ `X-User-Id` ເປັນ header ທຳມະດາ
**ທີ່ພົບ:** service ອ່ານ identity ຂອງ user ຈາກ header `X-User-Id` ທີ່ BFF ຕັ້ງ. ບໍ່ມີການຜູກພັນດ້ານ cryptography — ຖ້າ client ໃດໜຶ່ງສາມາດເຂົ້າເຖິງ endpoint ພາຍໃນໂດຍກົງ (firewall ຕັ້ງຜິດ), ກໍສາມາດ spoof user ID ໃດກໍໄດ້.
**ຄວາມສ່ຽງ:** header spoofing ໃນ endpoint ພາຍໃນ ຖ້າ network isolation ລົ້ມເຫລວ.
**ຂໍ້ສະເໜີ:** `InternalTokenGuard` ຊ່ວຍຫຼຸດຄວາມສ່ຽງໄດ້ສ່ວນໜຶ່ງ, ແຕ່ຄວນພິຈາລະນາ sign header identity ທີ່ສົ່ງຕໍ່ (HMAC ຂອງ `userId:correlationId:timestamp`) ເພື່ອໃຫ້ service ກວດສອບໄດ້ວ່າ BFF ເປັນຜູ້ຕັ້ງ.

#### ຕໍ່າ — Traefik TLS ໃຊ້ self-signed ໃນ dev ແລະ ບໍ່ redirect ອັດຕະໂນມັດ
**ທີ່ພົບ:** config Traefik ເປີດ `websecure` ດ້ວຍ `tls: {}` (Traefik self-signed) ແຕ່ບໍ່ໄດ້ຕັ້ງ `http.redirections` ເພື່ອ force HTTP→HTTPS. comment ສະແດງໃຫ້ເຫັນວ່າຄວນ configure ACME ຢູ່ໃສ.
**ຄວາມສ່ຽງ:** traffic dev ເປັນ plaintext ໂດຍ default; ນັກພັດທະນາອາດບໍ່ສັງເກດ.
**ຂໍ້ສະເໜີ:** ເພີ່ມ ACME resolver ແລະ redirect HTTP→HTTPS ກ່ອນ deploy staging.

#### ຕໍ່າ — OCR/Risk services ບໍ່ມີ authentication
**ທີ່ພົບ:** `services/ocr` (FastAPI) ແລະ `services/risk` (FastAPI) ເບິ່ງຄືວ່າບໍ່ໄດ້ຈັດຕັ້ງ authentication ໃດໆໃນ endpoint ຂອງຕົນ. ພວກມັນອາໄສ network isolation ທັງໝົດ.
**ຄວາມສ່ຽງ:** ຖ້າ service ທີ່ຖືກ compromise ໃນ compose network ສາມາດເຂົ້າເຖິງ, ກໍຈະຖາມໄດ້ຢ່າງອິດສະຫລະ.
**ຂໍ້ສະເໜີ:** ເພີ່ມການກວດສອບ `X-Internal-Token` ໃນທັງສອງ FastAPI service, ຄ່ຽງຄູ່ກັບ pattern ຂອງ NestJS.

#### ຕໍ່າ — Rate limit key ໃຊ້ `req.ip` ທີ່ອາດເປັນ `undefined` ໃນ proxy configuration ບາງຕົວ
**ທີ່ພົບ:** ໃນ `libs/nestkit/src/security/rate-limit.guard.ts`, key fallback ໄປເປັນ `'anon'` ເມື່ອ `req.ip` ເປັນ undefined. ຖ້າ reverse proxy ທີ່ຕັ້ງຜິດ strip IP ອອກ, ຄຳຮ້ອງຂໍ anonymous ທັງໝົດຈະໃຊ້ bucket ດຽວກັນ.
**ຄວາມສ່ຽງ:** rate limit ຈິງຈະກາຍເປັນ limit ຕໍ່ IP ທີ່ໃຊ້ກັບ traffic *ທັງໝົດ*, ບໍ່ແມ່ນຕໍ່ client.
**ຂໍ້ສະເໜີ:** ຢືນຢັນວ່າ `X-Forwarded-For` ຖືກ configure ໃນ Traefik forwarding headers; ເພີ່ມ warning log ຖ້າ `req.ip` ເປັນ undefined.

---

## 8. ການວິເຄາະດ້ານປະສິດທິພາບ

### ຈຸດແຂງ

| Pattern | ເຫດຜົນທີ່ສຳຄັນ |
|---------|---------------|
| `ledger_entries` append-only + advisory lock | ຈັດລຳດັບ ledger ຕໍ່ user ໂດຍບໍ່ lock ໂຕະທັງໝົດ; user ອື່ນບໍ່ໄດ້ຮັບຜົນກະທົບ |
| Redis SETNX machine locks | lock O(1) ດ້ວຍ TTL; ຫລີກລ່ຽງ DB polling ສຳລັບ reservation state |
| Outbox relay batch polling | batch size + poll interval ປັບໄດ້; relay ບໍ່ block request path ເລີຍ |
| Partial index ໃນ `outbox` | index `WHERE state='PENDING'` ຂະໜາດນ້ອຍ; relay query ອ່ານສະເພາະ row ທີ່ຍັງບໍ່ publish |
| `driver_locations` TimescaleDB hypertable | GPS ping ປະລິມານສູງໃຊ້ chunking ຕາມເວລາ ແລະ retention policies ອັດຕະໂນມັດ |
| NATS JetStream dedup | `dedupId = outbox.id` ປ້ອງກັນການປະມວນຜົນຊ້ຳ ໂດຍບໍ່ຕ້ອງ round-trip ເພີ່ມ |
| Wallet balance cache | `wallets.balance` ໄດ້ aggregate ledger ໃນທຸກການອ່ານ; invalidate ແບບ atomic ໃນ ledger transaction |

### ຈຸດອ່ອນ ແລະ ຄວາມກັງວົນ

#### ສູງ — `pg_advisory_xact_lock(hashtext($1))` ອ່ອນໄຫວຕໍ່ hash collision
**ທີ່ພົບ:** ledger repository ໃຊ້ `hashtext(userId)` (hash integer 32-bit) ເປັນ advisory lock key. ດ້ວຍ hash ທີ່ເປັນໄປໄດ້ ~4 ພັນລ້ານ ແລະ ຜູ້ໃຊ້ທີ່ເປັນໄປໄດ້ຫຼາຍພັນ, ຄວາມໜ້າຈະເປັນ birthday collision ທີ່ users ສອງຄົນໃຊ້ lock key ດຽວກັນ ບໍ່ຄວນຖືເບົາທີ່ scale (~0.01% ກັບ 10k users).
**ຄວາມສ່ຽງ:** users ສອງຄົນທີ່ບໍ່ກ່ຽວຂ້ອງກັນ ອາດ serialize ກັນໃນ ledger operations ຂອງກັນ, ສ້າງ contention ແລະ latency spikes ທີ່ບໍ່ຈຳເປັນ.
**ຂໍ້ສະເໜີ:** ໃຊ້ `hashtext(userId) :: bigint` (64-bit ຜ່ານ `('x' || md5(userId))::bit(64)::bigint`) ຫຼື ເກັບ integer sequence ຂອງ user ທີ່ deterministic ແລ້ວໃຊ້ເປັນ lock key ໂດຍກົງ.

#### ສູງ — Outbox relay row ທີ່ `FAILED` ບໍ່ໄດ້ retry ເລີຍ
**ທີ່ພົບ:** `outbox-relay.ts` mark row ວ່າ `FAILED` ເມື່ອ publish error ແຕ່ ບໍ່ມີ retry loop ທີ່ re-publish row FAILED. ເມື່ອ row FAILED ແລ້ວ ມັນຈະຢູ່ຄ້າງຖາວອນ.
**ຄວາມສ່ຽງ:** event ທີ່ fail ໃນຊ່ວງ NATS outage ຊົ່ວຄາວຈະສູນຫາຍຖາວອນ, ທຳລາຍການຮັບປະກັນ at-least-once.
**ຂໍ້ສະເໜີ:** ເພີ່ມ retry sweep ແຍກຕ່າງຫາກທີ່ຍ້າຍ row FAILED ກັບໄປ PENDING ຫລັງ delay back-off, ສູງສຸດ max_attempts ທີ່ configurable; alert ເມື່ອ row ເກີນ max_attempts.

#### ປານກາງ — Outbox relay poll ທຸກໆ 1 ວິນາທີ ໂດຍບໍ່ມີເງື່ອນໄຂ
**ທີ່ພົບ:** `OUTBOX_POLL_MS` default ເປັນ 1000ms. ທຸກ service ທີ່ relay ເປີດ ຈະ hit ຖານຂໍ້ມູນທຸກວິນາທີ ໂດຍ​ບໍ່​ຂຶ້ນ​ກັບ​ load.
**ຄວາມສ່ຽງ:** ດ້ວຍ 10+ service, ນັ້ນໝາຍຄວາມວ່າ 10+ DB query/ວິນາທີ ສຳລັບ relay ໃນ idle; ສິ້ນເປືອງໂດຍບໍ່ຈຳເປັນ.
**ຂໍ້ສະເໜີ:** ຈັດຕັ້ງ LISTEN/NOTIFY trigger ໃນຕາຕະລາງ `outbox` ເພື່ອປຸກ relay ທັນທີທີ່ insert, ໃຊ້ poll interval ເປັນ safety net ເທົ່ານັ້ນ. ວິທີນີ້ຈະ eliminate idle polling ທັງໝົດ.

#### ປານກາງ — Ledger `listEntries` ບໍ່ມີ index-only scan path
**ທີ່ພົບ:** `listEntries` run `SELECT * FROM ledger_entries WHERE user_id=$1 ORDER BY id DESC` — index `idx_ledger_user_time` ຢູ່ທີ່ `(user_id, created_at DESC)` ແຕ່ query ຈັດລຳດັບຕາມ `id`. index ບໍ່ຖືກໃຊ້ສຳລັບການ sort.
**ຄວາມສ່ຽງ:** ສຳລັບ user ທີ່ມີ ledger entries ຫຼາຍ, query ຈະ degrade ໄປເປັນ full index scan ທີ່ sort ໃນ memory.
**ຂໍ້ສະເໜີ:** ປ່ຽນ index ເປັນ `(user_id, id DESC)` ໃຫ້ຕົງກັນກັບ query ordering, ຫຼື ປ່ຽນ query ໃຫ້ໃຊ້ `ORDER BY created_at DESC` ໃຫ້ຕົງກັນກັບ index ທີ່ມີ. endpoint cursor-keyed (ຈັດຕັ້ງແລ້ວ) ຈຳກັດ row ແຕ່ sort ຍັງຕ້ອງ efficient.

#### ປານກາງ — ບໍ່ໄດ້ຕັ້ງ connection pool limits ສຳລັບ downstream services
**ທີ່ພົບ:** `service-client.ts` ຂອງ BFF ໃຊ້ `fetch()` ໂດຍກົງ; service NestJS ໃຊ້ `node-postgres` pools. ບໍ່ເຫັນ pool size ຫຼື connection timeout limits ທີ່ explicit ໃນ compose configuration.
**ຄວາມສ່ຽງ:** ພາຍໃຕ້ burst load, connection exhaustion ຕໍ່ PostgreSQL ເປັນໄປໄດ້ (default pg pool ໃນ node-postgres ບໍ່ຈຳກັດ).
**ຂໍ້ສະເໜີ:** ຕັ້ງ `max` connection pool size ໃນ `libs/nestkit/src/db/pg.ts` ຕາມ memory container ແລະ `max_connections` ຂອງ Postgres; ຕັ້ງ statement/connection timeouts.

#### ຕໍ່າ — `wallets.balance` ອາດ diverge ຈາກ ledger ເມື່ອ crash
**ທີ່ພົບ:** cache ຍອດ wallet ຖືກ update ພາຍໃນ ledger transaction ດຽວກັນ (`postAtomic` ຂຽນໃສ່ `ledger_entries` ແລະ relay publish `smartwash.ledger.posted.v1`), ແຕ່ `wallets.balance` ເອງ ບໍ່ໄດ້ update ໃນ transaction ດຽວກັນ — wallet service ເບິ່ງຄືວ່າ listen NATS event ແລ້ວ update ແບບ async.
**ຄວາມສ່ຽງ:** crash ລະຫວ່າງ ledger commit ແລະ wallet event consumption ຈະ leave cache stale. ການອ່ານ `wallets.balance` ຈະ return ຄ່າຜິດ ຈົນກວ່າ event ຈະຖືກ consume ໃນທີ່ສຸດ.
**ຂໍ້ສະເໜີ:** ຢືນຢັນວ່າ event consumer ຂອງ wallet service ເປັນ idempotent ແລະ wallet table update ຢູ່ໃນ DB transaction ດຽວກັນກັບການ acknowledge NATS message. ຫຼື ຄຳນວນຍອດ on-demand ຈາກ ledger ເມື່ອ wallet cache ບໍ່ຢູ່.

#### ຕໍ່າ — `driver_locations` ບໍ່ມີ time-based partitioning ຫຼື TTL
**ທີ່ພົບ:** `driver_locations` ເປັນຕາຕະລາງ append-only ທຳມະດາ. comment ໃນ schema ລະບຸວ່າເໝາະຈະເປັນ TimescaleDB hypertable ແຕ່ຍັງບໍ່ໄດ້ implement.
**ຄວາມສ່ຽງ:** ການຂະຫຍາຍຕົວທີ່ບໍ່ຈຳກັດ; query ສຳລັບທີ່ຕັ້ງລ່າສຸດ degrade ເມື່ອຕາຕະລາງໃຫຍ່ຂຶ້ນ.
**ຂໍ້ສະເໜີ:** Convert ເປັນ TimescaleDB hypertable ທີ່ partition ຕາມ `recorded_at`; ເພີ່ມ retention policy ເພື່ອລຶບຂໍ້ມູນທີ່ເກີນ 30 ວັນ.

#### ຕໍ່າ — ບໍ່ໄດ້ຕັ້ງ HTTP timeout ສຳລັບ BFF-to-service `fetch()` calls
**ທີ່ພົບ:** `libs/nestkit/src/shared/service-client.ts` (ແລະ `service-client.ts` ຂອງ BFF) ໃຊ້ `fetch()` ດິບ ໂດຍບໍ່ມີ `AbortController` / signal timeout.
**ຄວາມສ່ຽງ:** downstream service ທີ່ຊ້າ (ເຊັ່ນ OCR ທີ່ parse ຮູບໃຫຍ່) ສາມາດ hold connection BFF ໄວ້ຕະຫຼອດ, ທຳໃຫ້ Node.js event loop ຫມົດ ພາຍໃຕ້ concurrent load.
**ຂໍ້ສະເໜີ:** ເພີ່ມ `AbortController` ດ້ວຍ timeout ທີ່ configurable (ເຊັ່ນ 10s ສຳລັບ ledger/order, 30s ສຳລັບ OCR) ໃສ່ service-client fetch calls ທັງໝົດ.

---

## 9. Observability

stack ມາພ້ອມ OTEL pipeline ຄົບຊຸດ:

| Component | ຈຸດປະສົງ |
|-----------|---------|
| OpenTelemetry SDK (ທຸກ service) | Traces, metrics, ການ propagate correlation-id |
| Tempo 2.7.1 | ເກັບ trace (OTLP HTTP ທີ່ :4318) |
| Prometheus | Scrape metrics ຈາກ `/metrics` ໃນແຕ່ລະ service |
| Loki | ລວບລວມ log |
| Grafana | Dashboard ສຳລັບທຸກ component ຂ້າງເທິງ |
| Alertmanager | ຈັດ routing ຂອງ alert |

`correlation-id` ຖືກ propagate ຜ່ານທຸກ hop ຜ່ານ `libs/nestkit/src/correlation/correlation.ts` ແລະ ສົ່ງຕໍ່ເປັນ header ລະຫວ່າງ service.

---

## 10. Infrastructure ແລະ Deployment

| Environment | Orchestration |
|-------------|--------------|
| Development | Docker Compose (`infra/docker/docker-compose.dev.yml`) |
| Production | k3s Kubernetes (`infra/k8s/`) ດ້ວຍ Traefik IngressRoute |

**Backup/DR:** pgBackRest config ຢູ່ທີ່ `infra/backup/pgbackrest.conf`; k3s CronJob ຢູ່ທີ່ `infra/k8s/backup-cronjob.yaml`.

**CI/CD:** `.github/workflows/` scaffold ແລ້ວ (Phase 0).

---

## 11. ສະຖານະ Build Phase ປັດຈຸບັນ

| Phase | ສະຖານະ | ໝາຍເຫດ |
|-------|--------|-------|
| 0 — Foundation | ✅ ສຳເລັດ | Nx monorepo, schema, compose, CI skeleton |
| 1 — Identity + Core | ✅ ສຳເລັດ | Auth, RBAC, Order, Queue, BFF, Customer app ຂັ້ນຕໍ່າ |
| 2 — Payment chain | ✅ Scaffold ແລ້ວ | Payment, OCR, Fraud, Risk, Wallet, Ledger, Topup saga |
| 3 — Machine + IoT | ✅ Scaffold ແລ້ວ | Machine FSM, MQTT bridge, wash_order saga, device sim |
| 4 — Delivery | ✅ Scaffold ແລ້ວ | Delivery FSM, GPS, Driver app, delivery_order saga |
| 5 — Finance + Portals | ✅ Scaffold ແລ້ວ | Settlement, Reconciliation, Owner + Admin portals |
| 6 — Hardening | ⏳ ຍັງບໍ່ເລີ່ມ | Saga compensation ຄົບ, load tests, k3s production deploy, security pass |

---

## 12. ຂໍ້ສະເໜີສະຫຼຸບ

### ທັນທີ (ກ່ອນ Phase 6 hardening)

1. **ເພີ່ມ `infra/.env` ໃສ່ `.gitignore`** — ຢ່າ commit credentials ຈິງ.
2. **ແກ້ outbox FAILED retry** — ເພີ່ມ retry sweep ດ້ວຍ back-off; ຖ້າບໍ່ດັ່ງນັ້ນ event ຈະສູນຫາຍ ໃນ NATS outage ຊົ່ວຄາວ.
3. **ແກ້ ledger list sort index** — ປ່ຽນ `idx_ledger_user_time` ເປັນ `(user_id, id DESC)` ໃຫ້ຕົງກັນກັບ cursor-pagination query.
4. **Harden OCR/Risk ດ້ວຍ internal token** — FastAPI services ຮັບ call ຈາກ service ໃດກໍໄດ້ໃນ compose network.

### ກ່ອນ production

5. **MQTT credentials ຕໍ່ device** — ຕາມທີ່ອະທິບາຍໃນ `infra/mqtt/acl.conf`.
6. **ທົດແທນ `INTERNAL_SERVICE_TOKEN` ທີ່ໃຊ້ຮ່ວມກັນ** — ຍ້າຍໄປ mTLS ຫຼື identity ຕໍ່ service.
7. **ທົດແທນ token-paste ໃນ customer app** ດ້ວຍ Keycloak PKCE + `expo-secure-store`.
8. **Configure PostgreSQL pool limits** ແລະ statement timeouts ໃນ `libs/nestkit`.
9. **Convert `driver_locations` ເປັນ TimescaleDB hypertable** ດ້ວຍ retention policy.
10. **ເພີ່ມ request timeouts ໃສ່ `fetch()` service client calls ທັງໝົດ**.
