# SmartWash — Local / Dev Runbook

How to bring up the full stack and exercise the core flows end-to-end. Requires
Docker Desktop (or a Docker host) and, for the load scripts, [k6](https://k6.io).

> All ports below are the dev `docker-compose.dev.yml` mappings. The public
> gateway is Traefik on **:8088** (http) / **:8443** (https, self-signed).

---

## 1. Bring up the stack

```bash
# from the repo root, Docker running
cp infra/.env.example .env          # then set INTERNAL_SERVICE_TOKEN + secrets

docker compose -f infra/docker/docker-compose.dev.yml up -d --build
```

This starts the infra (Postgres+TimescaleDB, Redis, NATS JetStream, EMQX, MinIO,
Keycloak, Temporal, Prometheus/Grafana/Loki/Tempo/Alertmanager), the Traefik
gateway, and all services (auth, rbac, order, queue, bff, ledger, wallet,
payment, fraud, machine, delivery, gps, settlement, reconciliation, saga,
device-sim, ocr, risk).

The schema auto-loads on first boot. To (re)apply migrations explicitly:

```bash
DATABASE_URL=postgresql://smartwash:change_me@localhost:5432/smartwash \
  npx nx run db:migrate            # 01_schema.sql + 02_rbac_seed.sql
```

---

## 2. Health checks

> App services are **internal to the compose network** — they have no host port
> mappings (only the Traefik gateway and infra dashboards are published). Check
> them from inside the network, not via `localhost`.

```bash
DC="docker compose -f infra/docker/docker-compose.dev.yml"

# container health / status
$DC ps

# per-service readiness, from inside the network (ports are the in-container ones)
for s in auth:3001 rbac:3002 order:3003 queue:3004 bff:3005 wallet:3006 \
         ledger:3007 fraud:3008 payment:3009 machine:3011 delivery:3012 \
         gps:3013 settlement:3014 reconciliation:3015 ocr:8001 risk:8002; do
  svc=${s%%:*}; port=${s##*:}
  echo -n "$svc "; $DC exec -T "$svc" sh -c "wget -qO- localhost:$port/health/ready || true"; echo
done

# gateway smoke from the host (expects 401 — auth enforced at the edge)
k6 run tools/k6/smoke.js
# or: curl -i http://localhost:8088/api/bff/branches   # → 401
```

Published on the host: **gateway** http :8088 / https :8443 · Traefik dashboard
:8081 · Grafana :3001 · Prometheus :9090 · EMQX dashboard :18083 · MinIO console
:9001 · Keycloak :8080 · Temporal :7233 · Postgres :5432 · Redis :6379. (The
`saga` service is a Temporal worker with health on :3010, internal only.)

---

## 3. Seed prerequisites

Before a real topup/wash you need:

- **Keycloak**: realm `smartwash`, a client `smartwash-api`, and a customer user
  whose `preferred_username` = the customer's phone. Grab an access token (ROPC
  or auth-code).
- **DB seed rows** (psql): a `users` row with that phone; `user_roles`
  (customer, branch-scoped); a `branches` row (with `owner_account`); `machines`
  rows. Roles + permissions are seeded by `02_rbac_seed.sql`.
- **Device simulator**: set `SIM_DEVICES` on the `device-sim` service to JSON
  matching the seeded machines, e.g.
  `[{"machineId":"<uuid>","branchId":"<uuid>","code":"W001"}]`, then
  `docker compose ... up -d device-sim`.

---

## 4. End-to-end happy paths

### Topup (the No-Bank-API money-in)
1. `POST /api/bff/payments` `{type:"topup",amount:50000}` (Bearer token,
   Idempotency-Key) → `{qrRef,qrPayload,…}`.
2. Client uploads the slip image to MinIO, then
   `POST /api/bff/payments/{qrRef}/slip` `{imageObjectKey,slipHash}`.
3. The topup saga runs OCR → fraud → risk → decision; on PASS it posts a
   **Ledger TOPUP**. `GET /api/bff/wallet` shows the new balance.
   - To drive an exact amount in dev, the mock OCR honours hints in the object
     key: `uploads/x.jpg?amount=50000&ref=R1&account=OWNER-ACC-0001`.

### Self-service wash (dual-FSM saga)
1. `POST /api/bff/orders` `{branchId,machineId,type:"self_service",cycle:"normal"}`
   → RESERVED (Redis lock).
2. `POST /api/bff/orders/{id}/start` → emits `wash_requested`; the wash_order
   saga DEDUCTs the wallet → PAID, sends MQTT START.
3. device-sim runs STARTING→RUNNING→FINISHING→IDLE; the machine service emits
   MachineRunning/Finished → saga → order RUNNING → COMPLETED.

### Pickup/delivery (charge on delivery)
1. `POST /api/bff/orders` `{type:"delivery",…}` → RESERVED.
2. `POST /api/bff/orders/{id}/request-delivery` `{pickup,dropoff}` → delivery_order
   saga creates+prices the delivery and assigns a driver.
3. Driver app (`/api/bff/driver/...`): accept → advance → delivered; on
   completion the saga **charges wash+fee** and completes the order.

### Daily reconciliation (the fraud check)
`POST /api/bff/admin/reconciliation/run` `{branchId,date,statementLines:[…]}`
→ matches bank lines against the day's ledger TOPUPs → VERIFIED / REVIEW /
ORPHAN, and flags **SUSPICIOUS** TOPUPs with no bank backing. View in the admin
portal (`apps/admin-portal`).

---

## 5. Load tests

```bash
k6 run tools/k6/smoke.js                                   # no token
K6_TOKEN=<jwt> k6 run tools/k6/topup.js
K6_TOKEN=<jwt> BRANCH_ID=<uuid> MACHINE_ID=<uuid> k6 run tools/k6/wash.js
```

---

## 6. Gotchas

- **Mint tokens in-network.** Auth validates `iss = http://keycloak:8080/...`
  (in-cluster DNS), so fetch tokens from inside the compose network (e.g.
  `docker compose exec bff node -e "fetch('http://keycloak:8080/...')"`); a
  token minted via `localhost:8080` carries the wrong issuer and is rejected.
- **Docker Desktop DNS can be flaky right after start** (lookups fail mid-pull
  with "no such host"). Just re-run `docker compose up -d --build` — progress is
  cached. Traefik also doesn't see file changes through Windows bind mounts;
  `docker compose restart traefik` after editing `dynamic.yml`.
- **`INTERNAL_SERVICE_TOKEN` must be set** — internal endpoints fail-closed
  (deny) without it.
- **No seed data / Keycloak realm** → 401s. Do §3 first.
- **EMQX is anonymous in dev**; the ACL (`infra/mqtt/acl.conf`) is a prod
  artifact — don't enable strict authz without per-role/per-device credentials
  or you'll lock out the machine service + simulator.
- **Temporal `auto-setup`** shares the Postgres instance and creates its own
  databases on first boot — give it a few seconds.
- **Startup error logs are normal** until NATS/Temporal/EMQX are reachable;
  the outbox relays, saga worker, and MQTT bridge retry.

---

## 7. Backup / DR & deploy

- Backup/DR (pgBackRest + restic) and RPO/RTO: `infra/backup/README.md`.
- k3s deploy manifests (review before applying): `infra/k8s/README.md`.
- MQTT topic plan + prod ACL/TLS: `infra/mqtt/README.md`.
- Saga compensation matrix: `docs/saga/compensation-audit.md`.
