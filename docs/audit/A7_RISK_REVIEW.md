# A7_RISK_REVIEW.md — risk, blast radius, failure modes, recovery

> **PLANNING ONLY — no code/schema/API changed.** Risk analysis for
> `A7_IMPLEMENTATION_PLAN.md`. EPIC A · A7 — **shadow** wallet four-balance projection
> (no read cutover; legacy `wallets` stays authoritative).

## 1. Blast radius analysis
- **Worst case:** the projector writes a wrong/lagging `wallet_balances`. Because the app
  **reads legacy `wallets`** (no cutover until A8), customers and money are **unaffected** —
  impact is limited to the *shadow* `wallet_balances` table + drift alerts. Blast radius =
  observability + a derived cache.
- **No blast radius on:** legacy wallet reads/balances (untouched), the v1 consumer (untouched),
  the ledger/dual-write (A4/A5 unchanged, flags still OFF), other services, the public API, or
  the schema (no migration — `wallet_balances` already exists).
- The projector is **flag-gated** (`WALLET_PROJECTOR_V2_ENABLED`, default off) → zero footprint
  until deliberately enabled, even in prod.

## 2. Failure modes
| ID | Failure | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| F1 | Projector bug → wrong projection | Med | Low (shadow) | L1 + projection==legacy reconcile catches it; **drift pages**; truncate+rebuild |
| F2 | Out-of-order / nak-retry reorder across subs | Med | Low–Med | **delta-apply** (commutative) + A6 exactly-once inbox → order-independent |
| F3 | Duplicate delivery → double-apply | Low | Med | A6 inbox (`consumeOnce`) makes it a no-op; inbox row + apply in one txn |
| F4 | Poison `posted.v2` event | Low | Low | A6 DLQ (parked, never dropped); projector keeps draining the stream |
| F5 | Projector lag/outage | Med | Low | projection goes stale → reconcile drift + lag metric; legacy reads fine; resume catches up |
| F6 | Stale snapshot overwrite (if set-apply chosen) | Med | Med | prefer delta-apply; else per-account monotonic `last_txn_id` |
| F7 | Pre-existing legacy balance not in new ledger (mid-stream enable) | High | Med | rebuild from `ledger_entries` seeds `current`; or enable post-backfill (A5 §7) |
| F8 | `wallet_balances` divergence after a partial deploy | Low | Low | rebuild (§6) restores from source; cache is disposable |
| F9 | W1 broken (`current != Σ subs`) | Low | Med | W1 asserted by tests + reconcile; delta-apply keeps it invariant by construction |

## 3. Recovery procedure
| Scenario | Procedure |
|---|---|
| Drift detected (F1/F6/F9) | Page → `WALLET_PROJECTOR_V2_ENABLED=off` → triage reconcile output → fix → `TRUNCATE wallet_balances` → **rebuild** (ledger_entries for total, ledger_postings for full split) → re-enable → re-bake. No money to recover (reads were legacy). |
| Projector lag/outage (F5) | Restart/scale the consumer; the durable + inbox resume from the last sequence; reconcile confirms catch-up. |
| Poison message (F4) | Inspect the DLQ; fix the handler; `redrive` (A6) the DLQ back to the subject. |
| Bad rebuild | Rebuilds are idempotent and offline (projector paused); re-run; cache is disposable. |
| Full backout | Flag off, optionally truncate, revert the PR (additive, no schema). Legacy path never changed. |

**Recovery primitives:** instant flag-off, truncate-and-rebuild a disposable cache, A6
DLQ/redrive, and the fact that **nothing in A7 is authoritative** (reads stay legacy).

## 4. Pre-implementation conditions (before A7 code)
- Apply-rule decision: **delta-apply + exactly-once inbox** (recommended) vs set-apply +
  per-account monotonic (F2/F6).
- Flag `WALLET_PROJECTOR_V2_ENABLED` (default off) accepted.
- Rebuild covers **both** `ledger_entries` (transition total) and `ledger_postings` (full
  fidelity), with the split limitation documented (F7).
- L1 + projection==legacy reconcile + drift alerts scoped (F1).
- DB-gated test harness for the projector (reuse the A4/A5/A6 pattern).

## 5. GO / NO-GO recommendation
**🟢 GO to implement A7 — design-first, conditional on this plan's approval.** A7 is the
natural consumer of A6 and is **shadow**: no read cutover, no money authority change, no
migration, flag-gated default-off, and fully recoverable (truncate + rebuild a disposable
cache). Risk is **contained** to observability and a derived table; the highest-value design
decision is the **apply rule** (recommend delta-apply + A6 exactly-once) to be reorder-safe.

Recommended next step: implement A7 per `A7_IMPLEMENTATION_PLAN.md`; **do not** start A8 (read
cutover) or EPIC C (enforcement) — the projection==legacy and L1 gates must be green over the
bake window first.

**Carry-over (unchanged):** A5 dual-write is **not prod-enabled** (separate step, backfill +
staging zero-drift). Open findings in `A6_COMPLETION_REPORT.md` §5–§6 (minus H4, closed) and
the A3 VAT-rounding sign-off remain tracked.
