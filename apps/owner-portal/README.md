# SmartWash Owner Portal (React + Vite)

Phase 5 KPI dashboard (revenue, orders, machine utilization) for a branch owner.
Standalone — not part of the root npm workspace.

```bash
cd apps/owner-portal
npm install
npm run dev          # http://localhost:5173
```

Config: `VITE_API_BASE_URL` (default `http://localhost:8088/api`, the gateway).
Paste a Keycloak owner token + a branch id. RBAC `report.view` (branch-scoped)
is enforced at the gateway.
