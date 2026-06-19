# ADR-0002 — Append-Only Enforcement at the Database Layer

- **Status:** Accepted (applied — `infra/db/init/06_append_only_enforcement.sql`)
- **Date:** 2026-06-17
- **Relates to:** Finding **B2**; non-negotiable rule #2

## Context
`ledger_entries`, `audit_log`, `order_events`, and `machine_events` are append-only
by convention. The application code only INSERTs into them, but nothing prevented a
bug, manual query, or future change from issuing UPDATE/DELETE — the canonical
control gap for a money system whose ledger is the source of truth.

## Decision
Enforce append-only at the database layer:
1. `BEFORE UPDATE OR DELETE` trigger on each table raising `restrict_violation`.
2. `REVOKE UPDATE, DELETE` from the application role (defense in depth).

Mutable caches (`machine_status`, `wallets`) are explicitly excluded.

## Conditions honored
The migration adds guardrails only — it does not modify, rewrite, or delete any
historical financial record. It is idempotent (re-runnable).

## Consequences
- (+) Rule #2 becomes a guarantee, not a convention.
- (+) Corrections must be new `ADJUSTMENT` / `REFUND_REVERSAL` rows — as intended.
- (−) Any future legitimate mutation must be a new migration that drops/re-adds the
  trigger deliberately (acceptable — forces review).
- **Forward:** when ADR-0003 lands, add `ledger_transactions` / `ledger_postings`.
