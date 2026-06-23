# A4_READINESS_REVIEW.md — readiness to start increment A4

> Assesses whether EPIC A increment **A4** is ready to start, given A1–A3 are complete.
> Generated 2026-06-19. **Read-only — no source changed.** Decision only; A4 is
> STOP-and-ask (show plan → approve → implement).

## What A4 is (from `REMEDIATION_PLAN.md`)
> *`postTransaction()` repo — advisory-lock, dedup, outbox `posted.v2`. **Unused** (not
> wired into live flows; that begins at A5 dual-write).* Gate to advance: integration
> tests — **balanced · replay · concurrency · overdraft**.

A4 is the persistence adapter for the double-entry ledger: it takes an A3
`TransactionIntent`, resolves each posting's account (A2 `resolveAccount`), computes each
posting's running `balance_after`, writes `ledger_transactions` + `ledger_postings` + an
`outbox` row **atomically**, dedups on the idempotency key, and serializes concurrent
writers. It does **not** touch the legacy single-entry ledger or any live flow (A5+).

## A4 prerequisites checklist

| # | Prerequisite | State | Evidence |
|---|---|---|---|
| 1 | A3 transaction builder (balanced intents, 9 ops) | ✅ | `posting-rules.ts` (79 ledger tests) |
| 2 | A2 `resolveAccount()` get-or-create | ✅ | `pg-account.repository.ts` (registered) |
| 3 | A1 schema + deferred balanced trigger + append-only + `idempotency_key UNIQUE` | ✅ | A1 verify 6/6 |
| 4 | Outbox infra (`insertOutbox`, `OutboxRelay`) | ✅ | `@smartwash/nestkit` (used by legacy ledger) |
| 5 | Atomic txn + advisory-lock patterns | ✅ | `Database.withTransaction`, `pg_advisory_xact_lock` (`pg-ledger.repository.ts`) |
| 6 | `posted.v2` event payload contract | ✅ (spec) | `FINANCIAL_CONTRACT.md` §6 |
| 7 | `balance_after` read path (latest posting per account) | ✅ | `idx_postings_account(account_id, id DESC)` (A1) |
| 8 | Error taxonomy (Insufficient/Idempotency/Unbalanced/AccountInactive) | ✅ | `@smartwash/common` |

**Prereqs 1–8: met.** A4 design decisions to settle in its plan (not blockers):

| # | A4 design item |
|---|---|
| D1 | **Advisory-lock key strategy** for multi-account/multi-party transactions (deadlock-safe — e.g. lock a sorted set of touched accounts, or per-`userId` for wallet txns). |
| D2 | **Overdraft scope** — which accounts must stay ≥0 (user wallet liability sub-accounts: available/reserved/held/pending) vs. unconstrained (asset/revenue/VAT); enforce on the wallet side of RESERVE/HOLD/CAPTURE. |
| D3 | **`balance_after` computation** per account inside the txn (read last `balance_after` for each `account_id`, apply DR/CR sign by `acct_type` normal balance). |
| D4 | **Replay semantics** — on duplicate `idempotency_key`, return the stored transaction + postings; never re-insert, never re-fire the outbox. |
| D5 | **`posted.v2` emission** (additive; v1 stays). Full inbox/DLQ consume-side is **A6**, not A4. |
| D6 | **DB-backed integration-test harness** — A4's gate (balanced/replay/concurrency/overdraft) needs a real Postgres; the repo currently has none in jest. Decide: gate a jest integration spec on `DATABASE_URL` (present in CI), or express as `psql` verify scripts like A1–A3. |

## A4 scope guardrails (carry forward)
- A4 repo is **unused** by live flows (no saga/controller wiring until A5).
- Preserve ADRs, money model, chart of accounts, reconciliation model, append-only +
  double-entry, idempotency, auditability.
- Do **not** start A5 (dual-write), A6 (inbox/DLQ), A7 (wallet projection), EPIC C/D/E/F/G.
- One increment, one PR, tests-first, STOP-and-ask.

## GO / NO-GO recommendation for A4
**🟢 GO to start A4 (design-first).** All hard prerequisites are in place; A1–A3 are
committed, green, and off the live money path. The six items above are in-scope A4 design
decisions. Recommended next step: an **A4 implementation plan** (repo API, lock strategy,
overdraft rules, `balance_after` math, replay, `posted.v2` payload, and the integration-test
harness) for review **before** writing code — per the money STOP-and-ask rule.

**Carry-over (not A4 work):** the open findings in `A1_A2_COMPLETION_REPORT.md` §6–§7
(B3/B4, contract coverage, `LedgerPosted` v2, H1/H5, doc-hygiene) remain tracked to their
owning increments; and the A3 VAT-rounding policy (`A3_COMPLETION_REPORT.md` §5) awaits a
finance confirmation.
