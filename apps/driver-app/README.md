# SmartWash Driver App (Expo / React Native) — ⚠️ LEGACY / reference-only

> **This is NOT the primary mobile app.** The canonical mobile app is the Flutter
> super app at **`apps/smartwash-app`** (Customer · Driver · Staff in one login),
> where the driver mode has full parity with this app. This Expo app is kept as a
> **legacy / minimal reference** during a phased cutover and receives **no new
> features**. See **`docs/MOBILE_CUTOVER.md`**. Add new driver functionality to
> `apps/smartwash-app` instead.

Minimal Phase 4 flow: **login → assigned deliveries → accept/advance/complete +
report location**, via the BFF (`/api/bff/driver/...`) through Traefik.

## Standalone install
Not part of the root npm workspace (RN deps kept isolated). Run on its own:

```bash
cd apps/driver-app
npm install
npm run start
```

## Config & auth
`app.json` → `expo.extra.apiBaseUrl` (default `http://localhost:8088/api`).
The login screen signs in with username + password via Keycloak (resource-owner
password grant); the BFF resolves the driver and re-checks RBAC (`delivery.*`,
`location.report`). The "Report location" button posts a demo coordinate — real
GPS via `expo-location` was never finished here (it lives in the Flutter app).
