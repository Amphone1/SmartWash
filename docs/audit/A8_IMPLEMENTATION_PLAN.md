# A8_IMPLEMENTATION_PLAN.md — wallet read cutover (legacy → projection)

> **PLANNING ONLY — no code/schema/API/migration/flag changed by this document.**
> EPIC A · increment **A8**. Moves wallet **reads** from legacy `wallets.balance` to the A7
> `wallet_balances` projection, **per flow**, behind sub-flags, **shadow → serve**. Legacy
> **writes** continue (authoritative) until A9. Generated 2026-06-22. Companions:
> `A8_READINESS_REVIEW.md`, `A8_RISK_REVIEW.md`. **Approval of this plan is required before any A8 code.**
>
> **Rev 2 (2026-06-22, post-review):** folded four review findings — (#1) Stage-2 serve must stay a
> JSON **number**, not a string (wire-contract §2 / §3 A8a); (#2) the A8b gate must cover the served
> `available`, not just `current` (§3 A8b); (#3) EPIC C **L3 trial-balance is not built** → not a
> mandatory A8 gate (§5 / §6); (#4) **seed the projection** via rebuild before baking (§6).

## 1. Cutover architecture (per read site)
```
                         flag WALLET_READ_V2_<FLOW> (default off)
                                        │
caller ─▶ read site ─┬─ OFF ───────────────────────▶ legacy wallets.balance         (serve)
                     │
                     ├─ SHADOW (Stage 1) ─▶ read BOTH ─▶ serve LEGACY                (+ log/metric drift)
                     │                                   └▶ v2 wallet_balances (compare only)
                     │
                     └─ ON / SERVE (Stage 2) ─▶ v2 wallet_balances                   (serve)  + legacy compared
```
- A8 adds a **v2 read** beside the existing legacy read at each site; a per-flow flag selects
  `off | shadow | serve`. Nothing else moves. The A7 projector keeps writing `wallet_balances`;
  the A4/A5 dual-write keeps writing legacy `wallets` (authoritative).
- **Stage 1 (shadow)** is non-authoritative: it serves the legacy value and records drift — it is
  the mechanism that produces the readiness gate evidence per flow.
- **Stage 2 (serve)** flips only after that flow's gate is green; flip-back to legacy is instant.

## 2. New read primitive (shared by all flows)
Today `PgWalletProjectionRepository` has only `applyV2` / `reconcileL1` / `rebuild*` — **no
per-user balance getter**. A8 adds one, money-safe:
```
getProjected(userId): { available, reserved, held, pending, current }   // all bigint kip
  // current = available + reserved + held + pending  (W1)
  // SELECT ... ::text; carry as bigint/string internally; convert to number only at the JSON edge
```
- **Money rule (CLAUDE.md #1):** kip stays **BIGINT/string** for all *internal* math — never do
  arithmetic in JS `number`. The legacy path's float cast (`pg-wallet.repository.ts:27`
  `balance: Number(r.balance)`) is a pre-existing rule-#1 defect; do **not** add new mid-pipeline
  `Number()` casts in v2. (Optionally repair the legacy cast under the same hand-review; not required
  for A8 and out of this plan's diff.)
- **Wire-contract rule (review finding #1 — MUST hold):** the served JSON shape is **frozen**. The
  wallet read serves `WalletView.balance` as a JSON **number** (kip), and the Flutter client parses
  it as `((j['balanceKip'] ?? j['balance']) as num?).toInt()`
  (`apps/smartwash-app/lib/core/api/models/wallet.dart`). Serving a **string** would make that
  `as num?` cast yield `null → 0` — a silent "balance shows 0" break. So Stage-2 **serve must emit a
  JSON number**, converting bigint → `number` **only at the serialization edge**, with a documented
  safe bound (kip `< 2^53 ≈ 9.0e15`, far above any real balance; assert it and log if exceeded).
  "No contract change" wins over "serve as string." A real string-kip contract is a **separate,
  coordinated** migration (wallet service + BFF + `wallet.dart`), explicitly **out of A8**.
- A thin compare helper emits per-read drift metric/log when shadow or serve is active:
  `v2.current − legacy.balance` (and the relevant sub for wash).

## 3. Per-flow cutover (do in this order)

### A8a — TOPUP / balance reads  ·  flag `WALLET_READ_V2_TOPUP`
- **Read site:** `services/wallet/src/application/wallet.service.ts:16` `getBalance()` →
  `services/wallet/src/infra/db/pg-wallet.repository.ts:16` `get()` (`SELECT … FROM wallets`).
  Public route `GET /wallets/:userId`; consumed by the BFF topup/wallet read and the app balance view.
- **v2 read:** `getProjected(userId).current` from `wallet_balances`.
- **Sub served:** `current` (total spendable+committed, matching legacy single balance).
- **Stage 1 (shadow):** read both, **serve legacy**, log/metric `current − legacy`.
- **Stage 2 (serve):** return v2 `current` as a JSON **number** (bigint→number at the edge per the
  wire-contract rule §2), preserving the existing response shape, when the gate is green.
- **Gate:** 7-day zero-drift (projection==legacy) **+** L1 green for topup/balance scope.

### A8b — WASH reads (funds check)  ·  flag `WALLET_READ_V2_WASH`
- **Read site:** `services/saga/src/workflows.ts:170` `EnsureFunds` (“soft pre-check, the ledger
  DEDUCT is the real guard”) → activity `services/saga/src/activities.ts:127` `walletBalance()` →
  HTTP `GET /wallets/:userId` (same wallet service).
- **v2 read:** `getProjected(userId).available` from `wallet_balances`.
- **Sub served:** **`available`** — spendable *now*, excluding reserved/held/pending. (Legacy is a
  single balance; using `available` is the correct, stricter pre-check once the four-way split exists.)
- **Staging:** shadow (compare `available` vs legacy `balance`, serve legacy) → serve v2.
- **Safety:** this is a **soft** pre-check only; the ledger **DEDUCT remains the real overdraft
  guard** regardless of which read serves, so A8b cannot cause an overdraft even mid-bake.
- **Gate caveat (review finding #2):** the `projection==legacy` check compares **`current`**, not
  the served `available`. When a user holds reserved/held/pending funds, `available < current ≈
  legacy`, so `available` is **not** validated by projection==legacy and the pre-check becomes
  intentionally **stricter** (it may return `payment_pending` where legacy passed). De-risk in two
  steps: **(i)** first serve **`current`** for value parity (gate = projection==legacy, true
  zero-drift); **(ii)** then move the served sub to **`available`** as a deliberate, separately
  signed-off behavior change. The wash shadow metric must compare the **served** sub, not just
  `current`.
- **Gate:** 7-day zero-drift on the **served** quantity — `current` in step (i); in step (ii)
  validate `available` via L1 (`current == Σ postings`) + `available == current` for users with no
  reserved/held/pending.

### A8c — REFUND / history reads  ·  flag `WALLET_READ_V2_REFUND`
- **Read site:** refund/history balance reads (same `getBalance`/wallet-history path; refund flow
  does not itself write via this read).
- **v2 read:** `getProjected(userId)` — `current` plus the sub breakdown for history display.
- **Staging:** shadow → serve, identical pattern.
- **Gate:** 7-day zero-drift (refund scope).

## 4. Flags & staging control
| Flag | Flow | Values | Default |
|---|---|---|---|
| `WALLET_READ_V2_TOPUP` | A8a balance/topup | `off` \| `shadow` \| `serve` | `off` |
| `WALLET_READ_V2_WASH` | A8b funds check | `off` \| `shadow` \| `serve` | `off` |
| `WALLET_READ_V2_REFUND` | A8c refund/history | `off` \| `shadow` \| `serve` | `off` |
- Read via the existing `optionalEnv` convention (cf. `WALLET_L1_RECONCILE_ENABLED`); the value is a
  tri-state string — **validate it and treat any unrecognized value as `off`** (fail safe). Each flow
  is **independent**; one flow can serve while another is still shadow/off.
- **Flip-back is instant and per-flow:** set the flag to `off` → that read reverts to legacy on the
  next request. No deploy, no data change.

## 5. Reconciliation gates (money correctness — call out explicitly)
- **Per flow, before Stage-2 serve:** BOTH must be green over the bake window:
  - **L1 / W2 (internal):** `wallet_balances.current(u) == Σ natural balance of u’s ledger_postings`.
  - **Advance gate (projection==legacy):** `wallet_balances.current(u) == legacy wallets.balance(u)`.
  - Source of evidence = the A7 `WalletReconcileJob` (now BigInt-safe in its drift log, FIX 2).
- **Global cross-check (review finding #3 — L3 not yet built):** EPIC C **L3 trial-balance**
  (Σ all account balances == 0) is **not implemented** — no trial-balance job exists in
  `services/`/`libs/` (EPIC C is future). It is therefore **not a mandatory A8 gate**; A8 gates on
  **L1 + projection==legacy** only. *Optionally*, A8 may add a minimal read-only assertion
  (`SELECT SUM(balance) FROM accounts == 0`) as extra safety — a small additive check, **not** the
  EPIC C L2/L3 program.
- **Zero tolerance:** any non-zero `current − legacy`, `current − Σpostings`, or per-read shadow
  drift halts the flow’s promotion (and pages if serving).
- Add a per-read drift metric, e.g. `wallet_read_drift_total{flow=topup|wash|refund}` /
  `wallet_read_drift_kip`, alongside the existing A7 projection metrics.

## 6. Bake → promote → rollback sequence (per flow)
1. **Seed the projection first (review finding #4):** on any DB with existing balances,
   `wallet_balances` starts **cold** and would show permanent projection==legacy drift. Run
   `rebuildFromLedgerEntries` (transition total; or `rebuildFromPostings` post-backfill) **before**
   baking so `current` starts equal to legacy. Idempotent; run with the projector paused.
2. **Enable A7 projector** (`WALLET_PROJECTOR_V2_ENABLED`) + **L1 reconcile**
   (`WALLET_L1_RECONCILE_ENABLED=true`) so `wallet_balances` is live and reconciled.
3. Set the flow flag to **`shadow`** → serve legacy, accumulate per-read + reconcile drift.
4. **Bake 7 days**: require zero drift on the served quantity (projection==legacy) + L1 green
   (L3 trial-balance optional, finding #3).
5. Promote to **`serve`** → v2 now served; keep comparing legacy in the background.
6. **Rollback** at any time: flag → `off` → instant legacy revert (legacy still written; no data to recover).
7. Repeat for the next flow (A8a → A8b → A8c).

## 7. Test matrix
| Layer | Cases |
|---|---|
| Unit (pure) | flag resolver `off/shadow/serve`; v2 read maps subs → `current`/`available` as bigint; **no float cast**; W1 holds |
| Integration (DB-gated) | seed `wallet_balances` + legacy `wallets`; shadow → serves legacy + records drift; serve → returns v2; injected drift → flagged/paged; flip-back → legacy |
| Reconcile/gate | per flow: `current == Σ postings` (L1) and `current == legacy` (gate); global L3 trial-balance == 0 |
| Money type | internal math is bigint (no mid-pipeline `Number()`); **served JSON stays a number** (wire-contract §2); assert the bigint→number edge conversion is loss-free for kip `< 2^53` and that Flutter `wallet.dart` still parses the served value |
| Rollback | each flag `serve → off` reverts read to legacy within one request, no restart |

## 8. Rollback strategy (summary)
- **Instant, per-flow:** `WALLET_READ_V2_<FLOW>=off` → reads revert to legacy immediately.
- **Data:** none to recover — legacy `wallets` was never stopped (writes continue through A9); the
  projection is a derived cache (truncate + `rebuildFromLedgerEntries`/`rebuildFromPostings` if needed).
- **Code:** A8 is additive (a v2 read method + flag branches at three sites); revert the PR — no
  schema, no contract change, legacy path untouched.
- **Nothing in A8 is irreversible.**

## Cutover gates before A9 (write cutover — separate, STOP-and-ask)
A8a/b/c all serving v2 and **baking green** (projection==legacy + L1 + L3) · drift alerts armed ·
rebuild + flag-off rollback rehearsed · legacy reads provably unused before any write change.
**A9 (stop legacy writes / `ledger_entries` read-only history / remove dual-write shim) is NOT
designed here — one line of acknowledgement only; it is a later, separately-approved increment.**
