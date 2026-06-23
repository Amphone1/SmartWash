# ADR-0007 — Reconciliation L1 / L2 / L3 + Clearing & Suspense

- **Status:** Accepted (design approved; implementation gated by NO-GO)
- **Date:** 2026-06-17
- **Relates to:** Findings on reconciliation; depends on ADR-0003

## Context
"No Bank API" means correctness depends entirely on reconciling internal ledger
state against the owner's bank statements. Today only a partial branch-level run
exists (`reconciliation_runs`, `bank_statement_lines`) against a user-only
single-entry ledger; there is no L1 drift check and no platform-level trial balance.

## Decision
Three reconciliation levels on the double-entry ledger:

| Level | Identity checked | Mechanism |
|---|---|---|
| **L1** | `wallet.current(user) = Σ user wallet postings` | scheduled assert + alert on drift |
| **L2** | `bank:branch = Σ branch bank/clearing postings` | match branch statement ↔ postings |
| **L3** | `Σ DR = Σ CR` across all accounts (trial balance) | platform liability (wallets) = Σ assets − revenue |

- Top-ups credit `wallet:pending` via `clearing:branch`; on statement match they
  settle to `bank:branch` and move `pending → available`.
- Unmatched bank lines → `suspense:topup`; aged ledger credits with no bank line →
  exception → resolved by **ADJUSTMENT** (never edits).
- Auto-match by `(amount, ref, time-window, account)`; `REVIEW/SUSPICIOUS` to a
  manual queue with audited staff decisions.

## Consequences
- (+) Money is provably accounted end-to-end; orphans never silently disappear.
- (−) Requires clearing/suspense accounts (ADR-0003) before it is implementable.
- **NO-GO remains** until the Reconciliation Model + Settlement Model are approved.
