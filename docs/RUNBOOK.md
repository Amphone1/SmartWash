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
# NB: the node:slim images have no wget/curl — use node's built-in fetch.
for s in auth:3001 rbac:3002 order:3003 queue:3004 bff:3005 wallet:3006 \
         ledger:3007 fraud:3008 payment:3009 saga:3010 machine:3011 delivery:3012 \
         gps:3013 settlement:3014 reconciliation:3015 notification:3016 audit:3017; do
  svc=${s%%:*}; port=${s##*:}
  echo -n "$svc "
  $DC exec -T "$svc" node -e "fetch('http://localhost:$port/health/ready').then(r=>r.text()).then(console.log).catch(e=>console.log('FAIL '+e.message))"
done
# FastAPI services ship python, not node
for s in ocr:8001 risk:8002; do
  svc=${s%%:*}; port=${s##*:}
  echo -n "$svc "
  $DC exec -T "$svc" python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:$port/health/ready').read().decode())"
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

## 6. UI testing (browser + real device)

**Primary mobile app — Flutter super app (`apps/smartwash-app`).** This is the
canonical mobile app (Customer · Driver · Staff in one login). Run it against the
gateway:

```bash
cd apps/smartwash-app
flutter pub get
# Android emulator (10.0.2.2 = host loopback)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8088/api \
            --dart-define=KEYCLOAK_URL=http://10.0.2.2:8080
# iOS simulator uses 127.0.0.1; physical device uses the LAN_IP below.
```

Dev users below work here too; role(s) come from `realm_access.roles`. Driver map
needs `--dart-define=GOOGLE_MAPS_KEY=<key>` (placeholder tile without it). See
`apps/smartwash-app/README.md` and `docs/MOBILE_CUTOVER.md`.

> The Expo `customer-app` / `driver-app` instructions below are **legacy /
> reference-only** (apps retiring — see `docs/MOBILE_CUTOVER.md`). Use the Flutter
> app for new testing.

**Browser (portals + legacy Expo web).** One-time, as Administrator:
`Add-Content C:\Windows\System32\drivers\etc\hosts "127.0.0.1 keycloak"` — the
UIs log in at `http://keycloak:8080` so the token issuer matches what the auth
service validates. Then `npm run dev` in `apps/owner-portal` / `apps/admin-portal`
(Vite 5173/5174) and `npx expo start --web` in `apps/customer-app` /
`apps/driver-app` (Metro picks 8082 — 8081 is Traefik's dashboard). The Traefik
`dev-cors` middleware + Keycloak `webOrigins` already allow these origins.
Dev users: 205550{1..4}001 / `dev-pass-<phone>` (customer/driver/owner/admin).

**Real device (legacy Expo Go).** For the Flutter app, `flutter run` on a connected
device with the LAN_IP defines above. The legacy Expo flow: the phone can't resolve `keycloak`, so pin Keycloak's
public hostname to this machine's LAN IP (one issuer for every client):

```powershell
$env:LAN_IP = "192.168.x.x"     # this PC's Wi-Fi IP (Get-NetIPAddress)
docker compose -f infra/docker/docker-compose.dev.yml `
  -f infra/docker/docker-compose.lan.yml up -d keycloak auth
# keycloak was recreated -> dev realm is gone; reseed:
docker compose -f infra/docker/docker-compose.dev.yml exec -T keycloak `
  bash -c 'bash' < tools/seed/keycloak-setup.sh

cd apps/customer-app   # or apps/driver-app
$env:SMARTWASH_API_URL = "http://$($env:LAN_IP):8088/api"
$env:SMARTWASH_KEYCLOAK_URL = "http://$($env:LAN_IP):8080"
npx expo start          # scan the QR with Expo Go — phone on the SAME Wi-Fi
```

If the phone can't reach the PC, allow the ports once (Administrator):
`New-NetFirewallRule -DisplayName "SmartWash dev" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080,8088,8082,8083,19000-19006`.
Drop the overlay (plain dev compose `up -d keycloak auth` + reseed) to return
to the `keycloak:8080` issuer. The browser flow keeps working in LAN mode.

---

## 7. Gotchas

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

## 8. Backup / DR & deploy

- Backup/DR (pgBackRest + restic) and RPO/RTO: `infra/backup/README.md`.
- k3s deploy manifests (review before applying): `infra/k8s/README.md`.
- MQTT topic plan + prod ACL/TLS: `infra/mqtt/README.md`.
- Saga compensation matrix: `docs/saga/compensation-audit.md`.
