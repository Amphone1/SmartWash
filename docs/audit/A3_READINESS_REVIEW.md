# A3_READINESS_REVIEW.md — readiness to start increment A3

> Assesses whether EPIC A increment **A3** (pure posting-rules / transaction builder) is
> ready to start, given A1+A2 are complete (`A1_A2_COMPLETION_REPORT.md`).
> Generated 2026-06-19. **Read-only — no source changed.** Decision only; A3 itself is
> STOP-and-ask (show plan → approve → implement).

## What A3 is (from `REMEDIATION_PLAN.md`)
> *Pure posting-rules / transaction builder — the 9 ledger operations, each producing a
> balanced (`Σ DR = Σ CR`) set of DR/CR postings; VAT split by basis points with **floor +
> remainder**. No DB writes, no outbox.* Gate to advance: unit tests per op + rounding.
> (Persistence/advisory-lock/outbox is the next increment, **A4**.)

A3 is **pure domain logic** (`services/ledger/src/domain/…`). It consumes the A2 chart
(account *keys*, via `domain/accounts.ts`) and `@smartwash/common` money primitives; it does
**not** touch Postgres or `resolveAccount()` (those are A4 concerns).

## 8. A3 prerequisites checklist

| # | Prerequisite | State | Evidence |
|---|---|---|---|
| 1 | A1 ledger schema applied + verified (`accounts`, `ledger_transactions`, `ledger_postings`) | ✅ | A1 verify 6/6 |
| 2 | A2 chart of accounts + `account_kinds` catalog | ✅ | A2 verify 10/10 |
| 3 | Canonical key grammar + pure validators (`buildAccountKey`/`parseAccountKey`/`validateAccountRef`/`ACCOUNT_KINDS`) | ✅ | `services/ledger/src/domain/accounts.ts` (+14 unit tests) |
| 4 | Balanced-transaction DB backstop (`Σ DR = Σ CR` deferred trigger) | ✅ | `07` `smartwash_assert_balanced` |
| 5 | Idempotency backstop (`ledger_transactions.idempotency_key UNIQUE NOT NULL`) | ✅ | `07` |
| 6 | Money primitives (`Kip` bigint, `add/subtract/multiply`, `applyBasisPoints` floor) | ✅ | `libs/common/src/lib/money.ts` |
| 7 | Posting-rules spec (9 ops, DR→CR) | ✅ | `FINANCIAL_CONTRACT.md` §4 + `MONEY_MODEL_PROPOSED.md` §3 posting table |
| 8 | Money-flow sequences for each op | ✅ | `MONEY_FLOW_SPEC.md` flows 1–8 |
| 9 | Error taxonomy (`AccountNotFound/AccountInactive/CurrencyMismatch/InsufficientFunds/IdempotencyConflict/Validation`) | ✅ | `libs/common/src/lib/errors.ts` |
| 10 | **VAT remainder rule decided** — split gross→(net, VAT) so the rounding remainder posts to `tax:vat` | ⚠️ **A3 design item** | `applyBasisPoints` floors but returns only one side; A3 must compute the split (e.g. net = floor, `VAT = gross − net`) per `FINANCIAL_CONTRACT.md` §1, with rounding unit tests |
| 11 | **`UnbalancedTransaction` representation** — contract lists it (500 internal guard); no error class exists yet | ⚠️ **A3 design item** | add an additive `UnbalancedTransactionError` in `@smartwash/common`, or rely solely on the DB deferred trigger; decide in A3 |

Items 1–9: **met.** Items 10–11: **not blockers** — they are decisions to settle inside the
A3 plan (both are additive and self-contained).

## A3 scope guardrails (carry forward)
- **Pure only** — no DB, no outbox, no `resolveAccount()` DB call, no FSM side effects (A4+).
- **Do not** modify the approved money model, chart of accounts, or reconciliation model.
- **Do not** touch A4–A7 / EPIC C/D/E/F/G, or unrelated services.
- Vendor/franchise stay enum-only (A3 builds no vendor/franchise postings).
- One increment, one PR, tests-first, STOP-and-ask.

## 9. GO / NO-GO recommendation for A3

**🟢 GO to start A3 (design-first).** All hard prerequisites (1–9) are in place and verified;
A1/A2 are committed, green, and off the live money path; no open finding blocks pure
posting-rule work. The two ⚠️ items (VAT remainder split, `UnbalancedTransaction` error) are
in-scope A3 design decisions, not gaps.

**Recommended first step:** an A3 implementation plan (the 9 ops with exact DR→CR per
`FINANCIAL_CONTRACT.md` §4, the VAT floor+remainder rule, the per-op + rounding test matrix)
for review **before** writing code — per the money STOP-and-ask rule.

**Out of scope for A3 (do not start):** A4 persistence/outbox, A5 dual-write, A6 inbox/DLQ,
A7 wallet projection, EPIC C reconciliation. The open findings in
`A1_A2_COMPLETION_REPORT.md` §6–§7 are tracked to their owning increments and are not A3 work.
