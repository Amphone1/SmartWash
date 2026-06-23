# ADR-0004 — Four-Balance Wallet

- **Status:** Accepted (design approved; implementation gated by NO-GO)
- **Date:** 2026-06-17
- **Relates to:** BLOCKER **B3**; principle "Wallet is derived from ledger"

## Context
`wallets` exposes a single `balance`. There is no notion of funds committed to an
active wash, authorization holds for delivery, or provisional (pre-reconciliation)
top-ups. The platform needs `RESERVE/HOLD/RELEASE/CAPTURE` semantics.

## Decision
The wallet is decomposed into four liability sub-accounts per user:

| Balance | Meaning |
|---|---|
| `available` | spendable now |
| `reserved`  | committed to an in-flight wash saga |
| `held`      | authorization hold (e.g. charge-on-delivery) |
| `pending`   | provisional top-up, not yet bank-reconciled |

**Invariant:** `current = available + reserved + held + pending`, and
`current = Σ ledger postings to the user's wallet accounts` (L1, ADR-0007).

The cache is still updated **only** by consuming `LedgerPosted` (already true), and
must be applied monotonically by `ledgerId`/transaction order (fixes finding H1).

## Consequences
- (+) Supports reserve-then-capture; provisional top-ups can't be over-spent.
- (−) `GET /wallets/{userId}` contract changes to return four balances.
- **NO-GO remains** until the Wallet ERD is approved.
