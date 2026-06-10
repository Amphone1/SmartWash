# k6 Load Tests

Load/smoke scripts exercising the gateway + core flows. Requires
[k6](https://k6.io) installed; the stack running (`docker compose up`).

```bash
# smoke — gateway reachable + auth enforced (no token needed)
k6 run tools/k6/smoke.js

# topup flow (needs a customer Keycloak token)
K6_TOKEN=<jwt> k6 run tools/k6/topup.js

# self-service wash (needs token + seeded branch/machine ids)
K6_TOKEN=<jwt> BRANCH_ID=<uuid> MACHINE_ID=<uuid> k6 run tools/k6/wash.js
```

Env: `BASE_URL` (default `http://localhost:8088/api`), `K6_TOKEN`, `BRANCH_ID`,
`MACHINE_ID`.

Thresholds (fail the run if breached): p95 latency and check pass-rate per
script. Tune VUs/stages per environment. These are dev/staging load profiles —
not a substitute for a production capacity test.
