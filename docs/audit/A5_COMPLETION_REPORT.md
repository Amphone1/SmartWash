# A5_COMPLETION_REPORT.md — EPIC A increment A5 (dual-write shim + shadow reconcile)

> Completion evidence for **A5**. Generated 2026-06-19. **Read-only report.** Companion:
> `A6_READINESS_REVIEW.md`. Branch `epic-a/a2-accounts` (12 commits ahead of `origin/main`,
> not pushed). Tree clean. ⚠️ **Code applied behind flags (default OFF); NOT prod-enabled.**

## 1. Change summary
A5 commit **`e205c58`** — 16 files, **+706 / −5**:

| File | Kind |
|---|---|
| `services/ledger/src/infra/db/pg-transaction.repository.ts` | mod — `postWithClient(client,intent)` refactor (mirror shares legacy txn) |
| `services/ledger/src/domain/dual-write-map.ts` (+`.spec.ts`) | new — legacy→new mapping (pure) |
| `services/ledger/src/application/dual-write.shim.ts` | new — SAVEPOINT, fail-open/closed, shadow reconcile, metrics |
| `services/ledger/src/config/dual-write.config.ts` | new — flags (default off) |
| `services/ledger/src/infra/metrics/dual-write.metrics.ts` | new — Prometheus counters/histograms |
| `services/ledger/src/infra/db/pg-ledger.repository.ts` | mod — call `mirror()` in `postAtomic`/`postRefund` |
| `services/ledger/src/infra/db/pg-ledger.repository.dual.int.spec.ts` | new — DB integration gate |
| `services/ledger/src/{domain/ledger.ts, domain/ports.ts, api/dto.ts, api/ledger.controller.ts, app.module.ts}` | mod — additive optional context + DI |
| `infra/observability/alerts/ledger-dual-write.rules.yml` (+`prometheus.yml`) | new — alerts + `rule_files` |
| `docs/audit/REMEDIATION_PLAN.md` | mod — A5 → ✅ (flags off) |

**What shipped:** every authoritative legacy ledger write is mirrored into the new
double-entry ledger (A4) **in the same DB transaction**, **SAVEPOINT-isolated** and
**flag-gated** (default off), then shadow-reconciled against the legacy balance. Legacy
stays authoritative; **no read cutover; no customer-visible change**. No migration.

## 2. Requirements compliance
| Requirement | Status |
|---|---|
| Fail-open behavior | ✅ prod default; mirror error → `ROLLBACK TO SAVEPOINT`, legacy commits (verified) |
| SAVEPOINT isolation | ✅ `SAVEPOINT dual_write` around the mirror + forced `SET CONSTRAINTS IMMEDIATE` inside it |
| All paths behind flags | ✅ `LEDGER_DUAL_WRITE_MODE` / `_FLOWS` / `_SHADOW_RECONCILE` |
| Default all flags OFF | ✅ `readDualWriteConfig()` defaults `off` / no flows |
| Legacy authoritative | ✅ legacy entry + balance unchanged; mirror writes only the new (non-authoritative) tables |
| No read cutover | ✅ no read path touched |
| No behavior change for customers | ✅ disabled by default; flag-off test proves no mirror |
| Shadow validation / metrics / alerts / rollback before prod enablement | ✅ all implemented (this PR); prod-enable still requires the backfill caveat (§5) |

## 3. Test results (PG16)
| Target | Result |
|---|---|
| `nx test ledger` (no DB) | **94 passed, 10 skipped** / 10 suites (both int specs self-skip) |
| `nx test ledger` (with `DATABASE_URL`) | **104 passed** / 10 suites |
| `nx test common` | 25 (unchanged) |
| `nx lint ledger` / `nx build ledger` | clean / success |

**A5 dual-write integration gate** (`pg-ledger.repository.dual.int.spec.ts`) — all green:
- ✓ flag OFF (default): legacy write only, **no mirror**
- ✓ topup enabled: mirrors TOPUP+SETTLE with **ZERO drift** (`new current == legacy balance`)
- ✓ topup + wash sequence: new current tracks legacy balance (**zero drift**)
- ✓ **FAIL-OPEN**: an induced mirror overdraft is rolled back to the savepoint; the legacy
  DEDUCT still commits (balance unchanged); no mirror rows

**A4 integration** (`pg-transaction.repository.int.spec.ts`) — **6/6 still green** (the
`postWithClient` refactor did not regress it). Unit: `dual-write-map.spec.ts` (9, pure).

## 4. Drift-validation results
- On a fresh DB with the mirror enabled from the first op, **drift = 0** across topup and
  topup→wash sequences (asserted in the integration gate).
- Fail-open path emits `ledger_dual_write_error_total{reason=...}` and does **not** create
  drift in the authoritative balance.

## 5. Rollback verification
- **Kill switch:** flag OFF (default / `LEDGER_DUAL_WRITE_MODE=off`) → the "flag OFF" test
  proves zero mirror activity and zero new rows.
- **Per-op isolation:** the fail-open test proves a mirror failure rolls back **only** the
  mirror (savepoint), leaving the authoritative legacy write intact.
- **Data:** mirror writes only non-authoritative append-only tables → nothing to undo; PR is
  additive (no migration) and revertible.

## 6. Alerting & metrics
Metrics on the nestkit registry: `ledger_dual_write_total{flow,result}`,
`…_error_total{flow,reason}`, `ledger_shadow_drift_total{flow}`, `…_drift_kip`,
`…_latency_seconds`. Alerts (`infra/observability/alerts/ledger-dual-write.rules.yml`, wired via
`prometheus.yml rule_files`): **LedgerDualWriteDrift pages**; ErrorRate/Latency/Stalled warn.
All inert until flags are enabled.

## 7. Known caveat (prod enablement prerequisite — not a code defect)
Absolute shadow reconcile (`new current == legacy balance`) is zero on a **fresh** DB. In prod
the new ledger starts empty while legacy has history, so enabling dual-write mid-stream shows
drift = pre-existing balance until a **backfill** of the new ledger from legacy history (or a
**delta-mode** reconcile) is performed. This is a documented **pre-prod-enable** step; the A5
*code* (validation/metrics/alerts/rollback) is complete. Staging validation uses a fresh DB.

## 8. GO / NO-GO (A5)
**🟢 GO — A5 code complete and verified**, behind default-off flags, fail-open, SAVEPOINT-
isolated, legacy authoritative, no read cutover, no customer impact. **NOT enabled in prod.**
Production enablement remains gated by `A5_IMPLEMENTATION_PLAN.md` §9–§10 (staging zero-drift,
the backfill caveat §7, alert arming) and is a **separate, future, STOP-and-ask** step.
A6 readiness in `A6_READINESS_REVIEW.md`.
