# SmartWash Customer App (Expo / React Native) — ⚠️ LEGACY / reference-only

> **This is NOT the primary mobile app.** The canonical mobile app is the Flutter
> super app at **`apps/smartwash-app`** (Customer · Driver · Staff in one login).
> This Expo app is kept as a **legacy / minimal reference** during a phased cutover
> and receives **no new features**. See **`docs/MOBILE_CUTOVER.md`**. Do not build
> new functionality here — add it to `apps/smartwash-app` instead.

Minimal Phase 1 flow: **login → service selection → branch list → machine list**,
talking to the BFF through the Traefik gateway.

## Standalone install
This app is **not** part of the root npm workspace (React Native's deps are kept
isolated from the backend services). Install and run it on its own:

```bash
cd apps/customer-app
npm install
npm run start        # Expo dev server (press a / i / w for Android / iOS / web)
```

## Config
The API base URL comes from `app.json` → `expo.extra.apiBaseUrl`
(default `http://localhost:8088/api`, the Traefik gateway). Point it at your
gateway host when running on a device.

## Auth
The login screen signs in with phone + password via Keycloak (resource-owner
password grant) and stores the access token in `expo-secure-store`. The token is
sent as `Authorization: Bearer <token>` and the BFF resolves identity + RBAC.

## Typecheck
```bash
npm run typecheck    # or: npx nx run customer-app:typecheck (after install)
```
