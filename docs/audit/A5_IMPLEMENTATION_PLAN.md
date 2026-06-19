# A5_IMPLEMENTATION_PLAN.md — dual-write shim + shadow reconcile

> **PLANNING ONLY — no code/schema/API/migration changed by this document.**
> EPIC A · increment **A5**. ⚠️ First increment that writes the new ledger on **live
> money** (legacy stays authoritative). Generated 2026-06-19. Companions:
> `A5_DUAL_WRITE_STRATEGY.md` (mechanics), `A5_RISK_ASSESSMENT.md` (risk/blast/recovery).
> Approval of this plan is required before any A5 code.

## 0. Goal & guardrails
Mirror every authoritative legacy `ledger_entries` write into the new double-entry ledger
(A1–A4) **in the same DB transaction**, then continuously prove the two agree (zero drift)
on real traffic — without ever risking the authoritative write. Legacy remains the source
of truth for **all reads and decisions** through A7. Rollback is always "flip a flag."

## 1. Exact dual-write flow
Hook point = **inside the ledger service** (`PgLedgerRepository.postAtomic` / `postRefund`),
which already owns the `withTransaction` client — the only place a same-DB-txn mirror is
possible (the saga calls the ledger over HTTP, so caller-side mirroring would be a separate
txn).

```
POST /ledger/post  (legacy, now additively carrying branchId? vatBps? channel?)
└─ LedgerService.post → PgLedgerRepository.postAtomic(input)
   └─ db.withTransaction(client):
      1. advisory lock + dedup + balance + INSERT ledger_entries (LEGACY, authoritative)
      2. INSERT outbox ledger.posted.v1                              (LEGACY)
      3. ── if dualWriteEnabled(flow) AND context sufficient ──
         SAVEPOINT dual_write;
         try:
           intents = mapLegacyToIntents(input)        // §A5_DUAL_WRITE_STRATEGY
           for intent in intents:
             postWithClient(client, intent)            // A4 path on the SAME client
           shadowReconcile(client, userId)             // new current vs legacy balance
           metric: dual_write_ok{flow}++
         catch e:
           ROLLBACK TO SAVEPOINT dual_write;           // mirror undone; legacy untouched
           metric: dual_write_error{flow,reason}++     // FAIL-OPEN (see §3)
      4. COMMIT   (legacy entry + legacy outbox always commit; mirror commits iff step 3 ok)
```
`postWithClient(client, intent)` is an A4 refactor: extract the body of
`PgTransactionRepository.post` so it can run on a caller-supplied client (the legacy txn)
instead of opening its own. `post()` keeps wrapping it in `withTransaction` for A4's own use.

## 2. Transaction boundaries
- **One DB transaction** per legacy write: legacy entry, legacy outbox, the mirrored
  double-entry transaction(s), and the `posted.v2` outbox all commit/rollback together.
- The mirror is wrapped in a **SAVEPOINT** so a mirror failure rolls back **only** the
  mirror, never the authoritative legacy write (§3).
- No cross-service / cross-DB boundary is introduced (the saga's HTTP call is unchanged;
  all mirroring is within the ledger service's existing connection).
- Idempotency: legacy keeps its `idempotency_key`; mirror intents derive deterministic keys
  (`dual:{op}:{refId}`) so retries of the whole POST replay both sides exactly once.

## 3. Failure policy — **fail-open (recommended)**
The authoritative legacy write **MUST NOT** be broken by the unproven mirror. Therefore:
- **Production default = FAIL-OPEN:** mirror runs inside a SAVEPOINT; any mirror exception
  → `ROLLBACK TO SAVEPOINT` + `dual_write_error` metric; the legacy write still commits.
  A mirror gap becomes a *drift signal*, not an outage.
- **Staging default = FAIL-CLOSED:** in staging the mirror error aborts the whole txn so
  bugs surface loudly and are fixed before the staging-zero-drift gate.
- Controlled by `LEDGER_DUAL_WRITE_MODE = off | shadow_fail_open | shadow_fail_closed`.
- Rationale: the advance gate ("same-DB-txn") is satisfied — the mirror is in the same
  connection/txn — while the SAVEPOINT prevents the new path from endangering live money.

## 4. Feature-flag strategy
| Flag | Values | Purpose |
|---|---|---|
| `LEDGER_DUAL_WRITE_MODE` | `off`(default) / `shadow_fail_open` / `shadow_fail_closed` | master switch + failure mode |
| `LEDGER_DUAL_WRITE_FLOWS` | csv of `topup,wash,delivery,refund,adjust` | per-flow enable (topup first) |
| `LEDGER_SHADOW_RECONCILE` | `on`/`off` | enable inline drift check (can run mirror without it) |
- Read once at module init via `@smartwash/nestkit` env helper; **default off** → zero behaviour
  change until explicitly enabled. Per-flow gating lets topup dual-write soak before wash/refund.
- Flags are **runtime-config** (env/ConfigMap), flippable without a code deploy.

## 5. Rollback strategy
- **Instant:** set `LEDGER_DUAL_WRITE_MODE=off` (or remove a flow from `…_FLOWS`) and roll the
  config — the mirror stops; legacy is untouched throughout.
- **Data:** the mirror only INSERTs into the new (non-authoritative, append-only) tables;
  nothing to undo on rollback. New rows are inert until A7 reads them.
- **Code:** A5 changes are additive (savepoint + mapping + `postWithClient`); reverting the
  PR removes the shim with no schema change.
- No irreversible step in A5 (irreversibility starts at A9).

## 6. Shadow-validation strategy
- **Inline (per write):** after the mirror, compute new `current(user) = Σ natural balances of
  the user's wallet accounts` and compare to the legacy post-balance; mismatch → `drift` metric
  (+ structured log with userId, flow, legacy vs new, delta). Inline catches drift at the source.
- **Batch (scheduled, staging + prod):** a read-only job recomputes, per user touched in the
  window, legacy balance vs new current, and per branch the L2 identity; emits drift gauges and
  an exceptions list. This is the evidence for the **staging zero-drift** gate.
- **Identity:** `legacy wallets.balance(u) == new current(u)` (current, not available — robust to
  the pending/available timing; see strategy doc §mapping).

## 7. Metrics & drift detection (Prometheus, `nestkit` registry)
| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `ledger_dual_write_total` | counter | `flow,result` | mirror attempts (ok/error) |
| `ledger_dual_write_error_total` | counter | `flow,reason` | mirror failures (fail-open skips) |
| `ledger_shadow_drift_total` | counter | `flow` | inline balance mismatches |
| `ledger_shadow_drift_kip` | histogram | `flow` | magnitude of drift (kip) |
| `ledger_dual_write_latency_seconds` | histogram | `flow` | added latency of the mirror |
- Drift is **any** non-zero `current − legacy`. Target: `ledger_shadow_drift_total == 0` over
  the bake window.

## 8. Alerting requirements
| Alert | Condition | Severity |
|---|---|---|
| DualWriteDrift | `increase(ledger_shadow_drift_total[5m]) > 0` | **page** (correctness) |
| DualWriteErrorRate | `rate(ledger_dual_write_error_total[5m]) / rate(ledger_dual_write_total[5m]) > 1%` | warn → page if sustained |
| DualWriteLatency | p99 `ledger_dual_write_latency_seconds` > budget | warn (perf) |
| DualWriteStalled | mirror enabled but `rate(ledger_dual_write_total[10m]) == 0` while legacy writes flow | warn (silent-off) |
- Alerts wired in `infra/observability` (Prometheus rules + Alertmanager). **Drift pages**;
  it is the signal that blocks cutover.

## 9. Production rollout stages
1. **S0 — merged, flag off.** Mirror code in prod, `MODE=off`. Zero behaviour change.
2. **S1 — staging fail-closed.** `shadow_fail_closed`, all flows, synthetic + replayed traffic.
   Fix every drift/error. **Gate: staging zero-drift ≥ defined window.**
3. **S2 — prod topup, fail-open.** `shadow_fail_open`, `FLOWS=topup`. Soak; watch drift=0.
4. **S3 — prod wash.** add `wash` (+`delivery`). Soak.
5. **S4 — prod refund + adjust.** add `refund,adjust`. Soak.
6. **S5 — full dual-write, 7-day zero-drift bake** across all flows → satisfies the A8 cutover
   precondition. A5 stays fail-open/observe-only; **no reads move** (that is A8).

## 10. Cutover gates required before A6
A5 → A6 advance requires:
- ✅ `postWithClient` refactor landed with A4 integration tests still green.
- ✅ Dual-write **fail-open** verified: induced mirror failure does **not** affect the legacy
  commit (test).
- ✅ **Staging zero-drift** over the bake window (all flows), evidence captured.
- ✅ Drift/error/latency metrics emitting; alerts armed in `infra/observability`.
- ✅ Flag matrix documented; instant-off rollback rehearsed.
- ✅ Legacy remains authoritative for all reads (no read path changed).
- ✅ Mapping decisions (incl. ADJUSTMENT) and the pending/available reconcile identity signed off.
> A6 (inbox/DLQ) and A7 (wallet projection) only begin once the new ledger is *proven
> equivalent* here. Reads do not move until A8 (separate, per-flow, also flagged).

## Proposed code surface (for the A5 implementation PR — NOT in this doc)
- `services/ledger`: extract `postWithClient(client, intent)` (A4); dual-write shim + savepoint
  in `pg-ledger.repository.ts`; `mapLegacyToIntents`; `shadowReconcile`; flag config; drift
  metrics. Additive optional context on `PostEntryDto`/`PostInput` (`branchId`, `vatBps`,
  `channel`) — backward compatible.
- Callers (saga activities) pass the context they already hold — a later, separate step.
- `infra/observability`: Prometheus rules + Alertmanager routes.
- **All of the above is STOP-and-ask** (money + API + CI/observability) and is *proposed*, not
  implemented, here.
