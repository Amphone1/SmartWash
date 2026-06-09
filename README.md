# SmartWash v5 — Agent Kit

Feed this whole folder to the coding agent. Read order:

1. `BUILD_PLAN.md`            — master: structure, stack, 10 rules, phases
2. `infra/db/init/01_schema.sql` — the database (apply as first migration)
3. `contracts/openapi/*.yaml` — REST contracts (order, payment, ledger)
4. `contracts/events/events.schema.json` — event envelope + payloads (NATS)
5. `contracts/mqtt/mqtt.schema.json`      — WISE-4051 cmd/status/lwt
6. `docs/saga/wash_order.md`  — Temporal saga: forward + compensation
7. `infra/.env.example`       — config + secrets list
8. `infra/docker/docker-compose.dev.yml` — local dependencies
9. `.github/workflows/ci.yml` — pipeline

## Kickoff rule
Build ONE phase per PR. Start with Phase 0 (scaffold + infra + schema), then the
financial spine (payment + ledger + order, Topup flow E2E). Do NOT build all
services at once. Obey the 10 non-negotiable rules in BUILD_PLAN.md.
