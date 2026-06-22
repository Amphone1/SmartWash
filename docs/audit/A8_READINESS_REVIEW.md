# A8_READINESS_REVIEW.md — readiness to start increment A8

> Assesses whether EPIC A increment **A8** (wallet **read cutover**) is ready to start,
> given A1–A7 are complete and the A7 projection ships **shadow**.
> Generated 2026-06-22. **Read-only — no source changed.** Decision only; A8 is **STOP-and-ask**
> (it touches money reads → CLAUDE.md). Companions: `A8_IMPLEMENTATION_PLAN.md`, `A8_RISK_REVIEW.md`.

## What A8 is (from `REMEDIATION_PLAN.md` / A7 carry-over)
> *Move wallet **reads** off legacy `wallets.balance` onto the A7 `wallet_balances` projection,
> **per flow**, behind sub-flags, shadow→serve. Live money authority does not change — legacy
> **writes** continue until A9.*

A8 is the first increment where the **served** balance can come from the new ledger projection.
It does **not** stop legacy writes, change ledger math, or touch schema. Each flow (topup/balance,
wash funds-check, refund/history) gets its own `WALLET_READ_V2_*` flag with **instant flip-back**,
and advances **shadow dual-read → serve v2** only after its reconciliation gate is green.

## A8 hard prerequisites (block if any is RED)
| # | Prerequisite | State | Evidence / gap |
|---|---|---|---|
| 1 | **A7 projector validated** — `wallet_balances.current(u) == legacy wallets.balance(u)` (projection==legacy) **and** L1 internal (`current == Σ user ledger_postings`) GREEN over a bake window | 🟡 **PENDING** | Projector + L1 reconcile **code exists** (`WalletReconcileJob`, `PgWalletProjectionRepository.reconcileL1`), but both ship **default OFF** (`WALLET_PROJECTOR_V2_ENABLED`, `WALLET_L1_RECONCILE_ENABLED=false`). No bake-window zero-drift evidence yet. **Must enable + bake before serve.** (Note: the reconcile drift log was just made BigInt-safe — FIX 2 — so the evidence is now actually emitted instead of being swallowed as "L1 reconcile failed".) |
| 2 | **Drift alerts armed** (WalletProjectionDrift pages) + projector lag/DLQ metrics in place | 🟡 **PARTIAL** | Metrics exist (`walletL1DriftTotal{kind}`, `walletL1DriftKip`, `walletProjectionAppliedTotal`, `walletReconcileUsers`). Confirm the **alert rules** are wired in `infra/observability/alerts/` and paging routes are live. |
| 3 | **Truncate+rebuild proven** (`rebuildFromLedgerEntries` **and** `rebuildFromPostings`) + flag-off rollback **rehearsed** | 🟡 **PARTIAL** | Both rebuild methods exist, are idempotent, and are now **invocable** via `POST /internal/wallet/rebuild` (A8a; InternalTokenGuard, refuses while the projector is enabled unless `force=true`). Still needs the **rehearsal**: truncate `wallet_balances` → rebuild (both modes) → reconcile GREEN → flip a read flag off and confirm instant legacy revert. |
| 4 | **A5 dual-write state understood** — legacy still authoritative; dual-write flags still OFF | ✅ **MET** | A7 docs + `A5_*`: dual-write **not prod-enabled**, legacy `wallets` authoritative, flags default OFF. A8 changes **reads only**; writes stay legacy until A9. |

**Substrate is built; operational evidence is not yet demonstrated.** Every A8 building block
(projector, L1 reconcile, both rebuilds, metrics, instant flags) exists in code. What is missing
is the **enabled bake window with zero drift**, **armed alerts**, and a **rehearsed rollback** —
i.e. the safety evidence that gates *serving* v2.

## A8 design items to settle in its plan
| # | A8 design item |
|---|---|
| D1 | **v2 read method.** Add a per-user projection read on `PgWalletProjectionRepository` returning the four subs + `current` as **bigint/string kip** (no float). Today the projection repo only has `applyV2` / `reconcileL1` / rebuilds — there is no per-user balance getter. |
| D2 | **Per-flow flags.** `WALLET_READ_V2_TOPUP`, `WALLET_READ_V2_WASH`, `WALLET_READ_V2_REFUND` (default off; `optionalEnv` like `WALLET_L1_RECONCILE_ENABLED`); each independently flippable. |
| D3 | **Shadow dual-read.** Stage 1 reads **both** legacy + v2, **serves legacy**, logs/metrics any per-read drift — this *produces* the prereq-#1 zero-drift evidence per flow without changing served values. |
| D4 | **Money type fix carried into v2.** The legacy read casts money to float (`pg-wallet.repository.ts:28` `balance: Number(r.balance)`) — a CLAUDE.md rule #1 violation. The v2 path **must not** repeat it: carry kip as bigint/string, format with the kip formatter (`@smartwash/common`). |
| D5 | **Which sub each flow reads.** Balance/topup → `current`; wash funds-check → `available` (spendable now, not reserved/held/pending); refund/history → `current` + the sub breakdown. |
| D6 | **Gate evidence per flow.** 7-day zero-drift (projection==legacy) + L1 green **scoped to that flow** before its Stage-2 serve flip; global cross-check against EPIC C **L3 trial-balance** (Σ all account balances == 0). |

## A8 scope guardrails
- **Reads only.** No ledger write, no dual-write flag flip, no schema/migration, no API contract change.
- Legacy `wallets` stays **authoritative** and continues to be written (until A9).
- `wallet_balances` remains a derived cache; A8 only *reads* it (still written solely by the A7 projector).
- Per-flow flags default **OFF**; flip-back is instant and per-flow.
- Do **not** start A9 (stop legacy writes / make `ledger_entries` read-only history / remove the dual-write shim) or EPIC C (enforcement).

## GO / NO-GO recommendation for A8
**🟡 CONDITIONAL GO — design-first, staged.**
- **🟢 GO** to (a) approve this plan, and (b) implement **A8a Stage 1 (shadow dual-read)** plus enable the A7 projector + L1 reconcile to **start the bake** — none of this changes a served balance, and it is what generates the prereq-#1 evidence.
- **🔴 NO-GO** to **serve v2 (any flow's Stage 2)** until that flow's gate is green: projection==legacy zero-drift over the 7-day bake **+** L1 internal green **+** alerts armed (#2) **+** rebuild/rollback rehearsed (#3).

Rationale: the A8 substrate is complete and the read cutover is fully reversible (flag-off → instant legacy revert; legacy never stopped being written), but **serving** a money read off the projection demands demonstrated zero-drift evidence first. Do flows in order **A8a → A8b → A8c**, each baking independently.

**Carry-over (unchanged):** A5 dual-write is **not prod-enabled** (separate step; backfill +
staging zero-drift caveat, A5 §7). A9 (write cutover) and EPIC C (enforcement/freeze) remain
out of scope and STOP-and-ask. A3 VAT-rounding sign-off remains tracked.
