# A5_RISK_ASSESSMENT.md — risk, blast radius, recovery

> **PLANNING ONLY — no code/schema/API changed.** Risk analysis for `A5_IMPLEMENTATION_PLAN.md`.
> EPIC A · A5 — the first increment that writes the new ledger on **live money**.

## 1. Risk register
| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | Mirror bug **aborts the authoritative legacy write** → live money outage | Low (with design) | **Critical** | SAVEPOINT + **fail-open** in prod (§3 plan); staging is fail-closed; mirror can never roll back legacy |
| **R2** | Added mirror latency degrades the hot `/ledger/post` path | Medium | High | latency histogram + budget alert; per-flow enable; mirror is INSERT-only on same conn; batch reconcile (not inline) in prod if needed |
| **R3** | Mapping wrong → silent drift (new ≠ legacy) | Medium | High | inline + batch shadow reconcile; **drift pages**; staging zero-drift gate before prod; ADJUSTMENT flow last |
| **R4** | Idempotency collision between mirror keys and real saga keys | Low | High | mirror uses isolated `dual:*` keyspace until A8 |
| **R5** | Context missing at write site (no branch/vat) → mirror skipped, coverage gap looks like success | Medium | Medium | `dual_write_error{reason=missing_context}` metric + `DualWriteStalled` alert; coverage dashboard |
| **R6** | Connection-pool pressure (mirror lengthens each txn) | Medium | Medium | watch pool saturation; mirror shares the existing connection (no new connection); cap via flag |
| **R7** | Append-only growth: mirror ~2–3× new rows on `ledger_postings` | High (expected) | Low | storage planning; tables already append-only by design; expected, not a fault |
| **R8** | Flag misconfig (e.g. prod accidentally `fail_closed`) → R1 | Low | Critical | default `off`; explicit mode enum; config review + `DualWriteErrorRate` page; rehearse |
| **R9** | Replay/retry double-counts mirror | Low | High | deterministic `dual:*` keys + A4 replay path (proven in A4 gate) |
| **R10** | Reconcile reads stale/uncommitted state → false drift | Low | Medium | inline reads same client (sees mirror); batch reads committed only; identity uses `current` |

## 2. Blast radius analysis
- **Worst case if fail-open holds (prod default):** the mirror is wrong or throws → legacy still
  commits → **users and money are unaffected**; impact is limited to *new-ledger rows being
  absent/incorrect* and *drift alerts firing*. No customer-visible effect. Blast radius =
  observability + the (non-authoritative) new tables.
- **Worst case if fail-closed leaked to prod (R1/R8):** a mirror exception aborts `/ledger/post`
  → that single money operation fails for that user (topup/wash/refund returns 5xx). Bounded to
  the enabled flow(s); instant-off flag restores service. This is the scenario the design
  forbids in prod (fail-open + default-off + alerts).
- **Latency blast radius (R2):** confined to the ledger write path; reads, other services, and
  the saga are unaffected. Per-flow flags bound exposure to the enabled flow.
- **No blast radius on:** legacy reads/balances (untouched), the saga/Temporal flow (HTTP
  unchanged), other services, schema (no migration), or the public API contract (additive
  optional fields only).

## 3. Recovery procedures
| Scenario | Procedure |
|---|---|
| Drift detected (R3) | Page → set `LEDGER_DUAL_WRITE_MODE=off` (stops mirror) → triage drift list (batch job output) → fix mapping → re-enable in staging → re-bake. Legacy stayed authoritative; no money to recover. |
| Latency/pool pressure (R2/R6) | Remove the hot flow from `LEDGER_DUAL_WRITE_FLOWS` (or `MODE=off`); the write path returns to legacy-only immediately. |
| Mirror error spike (fail-open) | Alert (`DualWriteErrorRate`); `MODE=off`; legacy unaffected; investigate offline. |
| Accidental fail-closed in prod (R8) | If `/ledger/post` 5xx spike correlates with mirror: `MODE=off` (or `shadow_fail_open`) and config-roll; rehearsed runbook. |
| Bad mirror data already written | New tables are non-authoritative and append-only → no cleanup needed; corrections are new rows; nothing reads them until A7. |
| Full backout | `MODE=off`, then revert the A5 PR (additive, no schema) at leisure. |

**Recovery primitives:** instant flag-off (no deploy), per-flow disable, PR revert, and the
fact that **nothing in A5 is authoritative or irreversible**.

## 4. Pre-implementation conditions (must be true before A5 code)
- Fail-open + SAVEPOINT design accepted (R1).
- Mapping table + ADJUSTMENT rule + reconcile identity signed off (R3, strategy §4).
- Metric/alert set agreed and `infra/observability` change scoped (R3/R5).
- `postWithClient` refactor scoped without regressing the A4 gate.
- Optional-context DTO extension agreed as additive/backward-compatible (R5).

## 5. GO / NO-GO recommendation
**🟢 GO to implement A5 — conditional on this plan's approval and these guardrails being
built in:** (1) prod **fail-open** via SAVEPOINT so the mirror can never break the authoritative
write; (2) **default-off**, per-flow flags; (3) drift/error/latency metrics + **drift-pages**
alerting before any prod enable; (4) **staging zero-drift gate** before S2; (5) sign-off on the
mapping (incl. ADJUSTMENT) and the `current`-based reconcile identity.

This is the highest-risk increment to date, but the risk is **contained by design**: legacy
stays authoritative, the mirror is SAVEPOINT-isolated and flag-gated, nothing is irreversible,
and recovery is a config flip. Recommend proceeding to an **A5 implementation** only after this
plan is approved; **do not** advance to A6/A7 (or move any read) until the cutover gates in
`A5_IMPLEMENTATION_PLAN.md` §10 are met.

**Carry-over (unchanged):** open findings in `A1_A2_COMPLETION_REPORT.md` §6–§7 and the A3
VAT-rounding finance sign-off remain tracked to their owning increments.
