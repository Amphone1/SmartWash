# A7_READINESS_REVIEW.md — readiness to start increment A7

> Assesses whether EPIC A increment **A7** is ready to start, given A1–A6 are complete.
> Generated 2026-06-19. **Read-only — no source changed.** Decision only; A7 is STOP-and-ask.

## What A7 is (from `REMEDIATION_PLAN.md`)
> *Wallet four-balance projection (`posted.v2`), monotonic `last_txn_id`, L1 reconcile.*
> Live money? **❌ reads legacy.** Gate to advance: **projection == legacy; L1 green.**

A7 builds the **wallet projector**: consume `smartwash.ledger.transaction.posted.v2` (via the
A6 `ReliableConsumer`) and project the four balances into `wallet_balances`
(available/reserved/held/pending), applying **monotonically** by `txnId` (`last_txn_id` guard,
W3 — fixes H1). It also adds the **L1 reconcile** (`wallet.current(u) == Σ user wallet
postings`). The projection is **shadow** — the app still reads the legacy wallet; reads do not
move until **A8**. The gate is that the projection equals legacy and L1 is green.

## A7 prerequisites checklist
| # | Prerequisite | State | Evidence |
|---|---|---|---|
| 1 | `posted.v2` emitted (account + balanceAfter + userId) | ✅ | A4/A5 outbox payload (`FINANCIAL_CONTRACT.md` §6) |
| 2 | Exactly-once consume substrate (inbox/DLQ) | ✅ | A6 `ReliableConsumer` / `consumeOnce` |
| 3 | `wallet_balances` table (4 balances + `last_txn_id`) | ✅ | A1 `07_double_entry_ledger.sql` |
| 4 | Natural-sign per-account balances in postings | ✅ | A4 `balance.ts` / `balance_after` |
| 5 | Legacy wallet balance to compare against (gate) | ✅ | legacy `wallets.balance` |
| 6 | A target service to host the projector | ✅ | `services/wallet` (existing v1 consumer) |

Prereqs **met.** A7 design decisions to settle in its plan:

| # | A7 design item |
|---|---|
| D1 | **Apply rule.** Recommend **set-to-`balanceAfter`** per user posting (the event carries each account's natural balance) rather than delta — idempotent and drift-free. Update the matching `wallet_balances` sub-column; recompute `current`. |
| D2 | **Monotonic guard (W3).** Apply a transaction only if `txnId > last_txn_id`; set `last_txn_id = txnId`. Ignore stale/duplicate redeliveries (belt-and-suspenders with the A6 inbox). |
| D3 | **Projector wiring.** New v2 consumer in `services/wallet` on the A6 `ReliableConsumer` (durable, maxDeliver, DLQ). The existing v1 consumer stays until A8. |
| D4 | **L1 reconcile job.** `wallet.current(u) == Σ natural balance of user's ledger postings`; drift → alert (report-only at A7; freeze is A8/EPIC C). |
| D5 | **Gate evidence.** A comparison job: `wallet_balances.current(u) == legacy wallets.balance(u)` over a window → the "projection == legacy" advance gate. (Same fresh-DB vs prod-backfill caveat as A5 §7 applies.) |
| D6 | **Test harness.** DB-gated integration (project a sequence of `posted.v2` → assert the four balances + W1 + monotonic skip) + L1 assertion. |

## A7 scope guardrails
- Projection is **shadow** — **no read cutover** (that is A8). App still reads legacy wallet.
- Preserve ADRs, append-only, double-entry, idempotency, chart of accounts, reconciliation.
- Dual-write flags remain default OFF; legacy authoritative.
- `wallet_balances` is a mutable cache (not append-only) — updated only by the projector.
- Do **not** start A8 (read cutover) or EPIC C (enforcement).

## GO / NO-GO recommendation for A7
**🟢 GO to start A7 (design-first).** All prerequisites are in place; A7 is the natural
consumer of A6 and is **shadow** (no read cutover, no money authority change) → moderate risk.
Recommended next step: an **A7 implementation plan** (apply rule, monotonic guard, projector
wiring on `ReliableConsumer`, L1 reconcile, the projection==legacy gate job, and the test
matrix) for review before code — per the money STOP-and-ask rule. The projector touches no new
schema (`wallet_balances` exists); if a reconcile/exception table is wanted, that is a
hand-reviewed migration.

**Carry-over (unchanged):** A5 dual-write is **not prod-enabled** (separate future step, with
the backfill caveat + staging zero-drift gate). Open findings in `A1_A2_COMPLETION_REPORT.md`
§6–§7 (minus H4, now closed by A6) and the A3 VAT-rounding sign-off remain tracked.
