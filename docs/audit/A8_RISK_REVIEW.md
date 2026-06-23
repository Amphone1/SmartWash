# A8_RISK_REVIEW.md — risk, blast radius, failure modes, recovery

> **PLANNING ONLY — no code/schema/API/flag changed.** Risk analysis for
> `A8_IMPLEMENTATION_PLAN.md`. EPIC A · A8 — wallet **read cutover** (legacy → A7 projection),
> per-flow, shadow→serve. Legacy `wallets` stays **authoritative** and written until A9.

## 1. Blast radius analysis
- **Higher than A7** because A8 can change a **served money read** — but bounded by staging and flags:
  - **Stage 1 (shadow):** serves legacy, only reads v2 to compare → blast radius = observability only
    (identical to A7: a derived cache + metrics).
  - **Stage 2 (serve):** the *displayed/checked* balance for that one flow comes from `wallet_balances`.
    Worst case = a wrong/lagging projection shows an incorrect balance or mis-gates a wash pre-check.
- **Money cannot be lost or double-spent by A8:** all **writes** remain on the legacy ledger/dual-write
  (authoritative), and the **wash DEDUCT** (the real overdraft guard) is unchanged. A8 only changes
  what value is **read/shown**, never what is **debited/credited**.
- **No blast radius on:** ledger math, `ledger_entries`/`ledger_postings`, dual-write (A4/A5, flags
  still OFF), schema (no migration), the A7 projector writes, or any other service’s logic.
- **Per-flow isolation:** each `WALLET_READ_V2_*` flag is independent; a problem in one flow cannot
  affect another, and flip-back is instant.

## 2. Failure modes
| ID | Failure | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| F1 | Projection wrong/stale → wrong served balance (Stage 2) | Med | Med | Gate is 7-day zero-drift before serve; shadow drift + reconcile **page**; flag→off instant revert |
| F2 | Projector **lag** → served balance trails reality | Med | Med | `wallet_projection_lag_seconds` warn; serve only after bake; lag spike → flip the flow to `off` |
| F3 | Wash funds-check reads stale `available` → **false** insufficient-funds (UX) or false pass | Low–Med | Low | Pre-check is **soft**; ledger **DEDUCT** is the real guard → no overdraft; `available` chosen (stricter); shadow first |
| F4 | **Float precision** reintroduced on the v2 read | Low | High | Plan D4: v2 carries **bigint/string kip**, never `Number()`; unit test asserts no precision loss; do not copy `pg-wallet.repository.ts:28` |
| F5 | Drift evidence swallowed/unreadable | Low | Med | FIX 2 made the L1 drift log **BigInt-safe** (was throwing + mislabeled “L1 reconcile failed”); alerts must be armed (prereq #2) |
| F6 | Promote before gate truly green (premature serve) | Med | Med | Readiness #1 is RED until baked; serve flip requires zero-drift + L1 + L3; staged flags prevent a global flip |
| F7 | Shadow dual-read adds latency / load (2 reads) | Low | Low | Shadow is temporary + per-flow; v2 read is a single indexed PK lookup; can disable instantly |
| F8 | Rebuild collapses four-way split (ledger_entries mode) mid-bake | Low | Low | Use `rebuildFromPostings` for full fidelity post-backfill; `current` total stays correct either way (A7 §6) |
| F9 | Legacy vs projection diverge due to A5 backfill gap (pre-existing balances) | Med | Med | Same A5 §7 caveat; seed via rebuild from `ledger_entries`; bake on reconciled data before serve |
| F10 | Operator flips wrong flow’s flag | Low | Low | Flags namespaced per flow (`_TOPUP/_WASH/_REFUND`); change is reversible in one request |

## 3. Recovery procedure
| Scenario | Procedure |
|---|---|
| Served-balance drift / page (F1/F2/F4/F6) | `WALLET_READ_V2_<FLOW>=off` → instant legacy revert (no data to recover) → triage reconcile/shadow output → fix → re-bake from `shadow`. |
| Projector lag/outage (F2) | Flip affected flows to `off` (legacy reads fine); restart/scale the projector; reconcile confirms catch-up; resume `shadow`→`serve`. |
| Wash mis-gate (F3) | Flip `WALLET_READ_V2_WASH=off`; DEDUCT guard meant no money moved incorrectly; investigate `available` drift. |
| Projection corruption (F8/F9) | Flags off → legacy serves; `TRUNCATE wallet_balances` → rebuild via `POST /internal/wallet/rebuild` (A8a; `ledger_entries` total or `postings` full; offline-guarded) → reconcile GREEN → re-bake. |
| Full backout | All `WALLET_READ_V2_*` → off; revert the A8 PR (additive, no schema); legacy read path is byte-for-byte unchanged. |

**Recovery primitives:** per-flow instant flag-off, legacy never stopped (authoritative writes
continue), truncate-and-rebuild a disposable cache, A6 DLQ/redrive for the projector, and the
fact that **A8 changes reads only** — no debit/credit path is touched.

## 4. Pre-implementation conditions (before A8 code / before serve)
- **Before any A8 code:** this plan approved; v2 read primitive spec’d as **bigint/string kip**
  (no float, F4); per-flow flags accepted (default off).
- **Before Stage-1 shadow:** A7 projector + L1 reconcile **enabled and running**; per-read drift
  metric added.
- **Before Stage-2 serve (per flow):** 7-day **zero-drift** (projection==legacy) **+** L1 internal
  green **+** EPIC C **L3 trial-balance == 0** **+** drift alerts armed (prereq #2) **+**
  truncate/rebuild and flag-off rollback **rehearsed** (prereq #3).

## 5. GO / NO-GO recommendation
**🟡 CONDITIONAL GO — design-first, staged, conditional on this plan’s approval.**
- **🟢 GO** to approve the plan and implement **A8a Stage 1 (shadow dual-read)** + enable the A7
  projector/reconcile to **bake** — this changes **no served value** and produces the gate evidence.
- **🔴 NO-GO** to **serve v2** for any flow until that flow’s gate is green (zero-drift + L1 + L3,
  alerts armed, rollback rehearsed).

Rationale: A8 is the first increment that can change a money **read**, so risk is higher than the
A7 shadow projection — but it is **contained** by per-flow staged flags, an unchanged authoritative
write path, the unchanged wash DEDUCT guard, and instant reversibility. The dominant risks are
**premature serve** (F6 — mitigated by the bake gate) and **float reintroduction** (F4 — mitigated
by the bigint-kip rule). Do flows **A8a → A8b → A8c**, each baking independently.

**Carry-over (unchanged):** A5 dual-write not prod-enabled (backfill + staging zero-drift caveat,
A5 §7). **A9** (stop legacy writes, `ledger_entries` read-only history, remove dual-write shim) and
**EPIC C** (enforcement/freeze) remain out of scope and **STOP-and-ask** — only after A8a/b/c bake green.
