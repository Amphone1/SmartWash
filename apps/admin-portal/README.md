# SmartWash Admin Portal (React + Vite)

Phase 5 ops dashboard: revenue, active orders, branches, drivers, and
**reconciliation status** (verified/review/suspicious/orphan + recent runs).
Standalone — not part of the root npm workspace.

```bash
cd apps/admin-portal
npm install
npm run dev          # http://localhost:5174
```

Config: `VITE_API_BASE_URL` (default `http://localhost:8088/api`). Paste a
Keycloak admin token; RBAC `report.view` is enforced at the gateway.
