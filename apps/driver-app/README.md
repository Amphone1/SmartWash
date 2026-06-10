# SmartWash Driver App (Expo / React Native)

Minimal Phase 4 flow: **token → assigned deliveries → accept/advance/complete +
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
Paste a Keycloak-issued driver access token; the BFF resolves the driver and
re-checks RBAC (`delivery.*`, `location.report`). The "Report location" button
posts a demo coordinate — real GPS via `expo-location` is a later refinement.
