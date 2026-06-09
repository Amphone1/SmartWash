# SmartWash Customer App (Expo / React Native)

Minimal Phase 1 flow: **token → service selection → branch list → machine list**,
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

## Auth (Phase 1)
There's no embedded Keycloak login yet — paste a Keycloak-issued access token on
the first screen. The token is sent as `Authorization: Bearer <token>` and the
BFF resolves identity + RBAC. A full login flow lands in a later phase.

## Typecheck
```bash
npm run typecheck    # or: npx nx run customer-app:typecheck (after install)
```
