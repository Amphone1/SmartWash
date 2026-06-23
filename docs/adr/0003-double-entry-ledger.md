# ADR-0003 — Double-Entry Ledger + Chart of Accounts

- **Status:** Accepted (design approved; implementation gated by NO-GO)
- **Date:** 2026-06-17
- **Relates to:** BLOCKER **B1**, **B4**; principle "Double entry accounting required"

## Context
The current ledger is **single-entry**: `ledger_entries` holds one signed row per
movement against a single per-user balance. It is internally correct (atomic,
advisory-locked, idempotent, outbox-coupled) but cannot represent the asset side of
money (cash at branch bank), clearing/suspense, platform vs branch revenue, or
inter-branch position — so branch (L2) and platform (L3) reconciliation and
multi-vendor settlement are impossible.

## Decision
Adopt a **double-entry** ledger. Every money movement is one balanced transaction
where `Σ debits = Σ credits`.

New tables (see `docs/design/MONEY_MODEL_PROPOSED.md`):
- `accounts` — chart of accounts (type, owner_type, owner_id, currency).
- `ledger_transactions` — journal header (type, correlation_id, idempotency_key UNIQUE).
- `ledger_postings` — append-only DR/CR lines (account_id, direction, amount, balance_after).

Invariant `Σ DR = Σ CR` enforced per transaction; postings are append-only
(ADR-0002 extended to the new tables).

## Consequences
- (+) Enables branch/platform/suspense/clearing accounting and true reconciliation.
- (+) Wallet becomes a set of liability sub-accounts (ADR-0004).
- (−) Migration from single-entry requires a backfill plan; both models coexist
  during transition. Source code paths (`ledger.postAtomic`) change → STOP-and-ask.
- **NO-GO remains** until the Ledger ERD + Chart of Accounts are approved.
