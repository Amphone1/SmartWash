# A4 — postTransaction() (double-entry write path)

> EPIC A · increment **A4**. Implemented 2026-06-19 on branch `epic-a/a2-accounts`.
> `services/ledger/src/infra/db/pg-transaction.repository.ts`. **Unused by live flows**
> until A5 (dual-write). No migration. Preserves all ADRs, append-only + double-entry,
> reconciliation assumptions, A3 posting rules, and the A2 chart of accounts.

## API
`TransactionRepository.post(intent: TransactionIntent): Promise<PostTransactionResult>`
— takes a balanced A3 intent, persists it atomically, returns `{ txnId, type, postings[], replayed }`.

## Algorithm (one DB transaction, `Database.withTransaction`)
1. **Replay** — `SELECT … WHERE idempotency_key`. If present, return the stored txn
   (`replayed: true`); never re-insert, never re-emit the outbox.
2. **Resolve** every distinct account via A2 `resolveAccount()` (get-or-create) on the
   same client — atomic with the postings.
3. **Advisory-lock** all touched account ids, sorted ascending
   (`pg_advisory_xact_lock(id::bigint)`) — deadlock-free (global order) and serializes
   any two transactions that share an account.
4. **Read** each locked account's current natural balance (latest `balance_after`).
5. **Insert** the journal header; a `idempotency_key` UNIQUE race is caught and turned
   into a replay.
6. **Per posting:** `balance_after = running natural balance + naturalDelta(acctType, dir, amount)`;
   **overdraft guard** (`violatesOverdraft` → user wallet sub-accounts may not go negative →
   `InsufficientFundsError`); insert the posting.
7. **Emit** `smartwash.ledger.transaction.posted.v2` to the outbox (same txn).

## Decisions (from `A4_READINESS_REVIEW.md`)
- **D1 Advisory-lock key** = `account_id`, acquired in sorted order → deterministic,
  deadlock-free; disjoint transactions run concurrently.
- **D2 Overdraft scope** = `owner_type='user'` accounts (available/reserved/held/pending)
  must stay ≥0; asset/revenue/VAT/staff/platform unconstrained.
- **D3 `balance_after`** = natural-sign running balance (`balance.ts`):
  ASSET/EXPENSE debit-positive; LIABILITY/REVENUE/EQUITY credit-positive. Multi-line
  same-account transactions accumulate correctly (in-memory running map).
- **D4 Replay** = return stored txn; **same key + different payload** (type or total DR)
  → `IdempotencyConflictError`.
- **D5 `posted.v2`** payload (kip as **decimal strings** to preserve BIGINT precision):
  ```
  { txnId, type, userId, postings: [ { accountKey, ownerType, ownerId, direction, amount, balanceAfter } ] }
  ```
  Outbox `aggregate_id` (UUID) = the moving user's id (wallet ordering) → else first
  non-null owner → else the system sentinel `0000…0000`. v1 remains valid; v2 is additive.
  Inbox/DLQ consume-side is **A6**, not A4.

## Invariants preserved
- **Append-only (C4):** only INSERTs; the A1 trigger + REVOKE still hold.
- **Double-entry (C3):** intents are balanced (A3) and the A1 deferred trigger is the
  final backstop at COMMIT.
- **Idempotency (C5):** `idempotency_key UNIQUE` + replay; retries never double-post or
  double-emit.
- **Auditability (C6):** `correlation_id` persisted on the header and folded into the
  outbox envelope.
- **Reconciliation:** natural balances + balanced postings keep L1/L3 assumptions intact;
  no chart-of-accounts change.

## Out of scope (A5+)
Wiring into the saga/controllers, the legacy dual-write shim + shadow reconcile (A5), the
inbox/DLQ consumer + wallet 4-balance projection (A6/A7). A4 ships the repo + tests only.

## Verification
- Unit: `balance.spec.ts` (naturalDelta, overdraft) — pure, always runs.
- Integration (the A4 gate): `pg-transaction.repository.int.spec.ts` — **balanced,
  TOPUP_SETTLE, replay (no double post/outbox), idempotency-conflict, overdraft,
  concurrency (one of two competing reserves wins)**. Requires `DATABASE_URL`; self-skips
  otherwise (runs in CI after `migrate`; locally via a throwaway PG16).
- No migration (`migrate` still applies `01..09`).
