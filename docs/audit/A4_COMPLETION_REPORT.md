# A4_COMPLETION_REPORT.md — EPIC A increment A4 (postTransaction write path)

> Completion evidence for **A4**. Generated 2026-06-19. **Read-only report — no source
> changed by this document.** Companion: `A5_READINESS_REVIEW.md`.
> Branch `epic-a/a2-accounts` (10 commits ahead of `origin/main`, not pushed). Tree clean.

## 1. Change summary

A4 commit **`ca1795e`** — 8 files, **+544 / −3**:

| File | ± | Kind |
|---|---|---|
| `services/ledger/src/infra/db/pg-transaction.repository.ts` | +212 | new — `postTransaction()` |
| `services/ledger/src/infra/db/pg-transaction.repository.int.spec.ts` | +151 | new — DB integration gate |
| `services/ledger/src/domain/balance.ts` | +36 | new — pure natural-sign math |
| `services/ledger/src/domain/balance.spec.ts` | +42 | new — unit tests |
| `services/ledger/src/domain/ports.ts` | +30 | mod — `TransactionRepository` port + result types |
| `services/ledger/src/app.module.ts` | +5/−... | mod — register `TRANSACTION_REPOSITORY` |
| `docs/design/A4_POST_TRANSACTION.md` | +67 | new — design doc |
| `docs/audit/REMEDIATION_PLAN.md` | +4/−2 | mod — A4 → ✅ |

*(Accepted A3 completion report + A4 readiness review committed separately as `dc852fb`.)*

**What shipped:** `TransactionRepository.post(intent)` — persists a balanced A3
`TransactionIntent` in **one** transaction: replay on `idempotency_key`, resolve accounts
(A2), advisory-lock all touched account ids in sorted order, compute natural-sign
`balance_after`, guard overdraft on user wallet sub-accounts, write
`ledger_transactions` + `ledger_postings` + a `posted.v2` outbox row. **Unused by live
flows** until A5.

## 2. Test results

| Target | Result |
|---|---|
| `nx test ledger` (no DB) | **85 passed, 6 skipped** / 8 suites (int spec self-skips) |
| `nx test ledger` (with `DATABASE_URL`, PG16) | **91 passed** / 8 suites (int spec runs) |
| `nx test common` | **25 passed** |
| `nx lint ledger` / `nx lint common` | clean |
| `nx build ledger` | success (tsc → esbuild) |

**A4 integration gate** (`pg-transaction.repository.int.spec.ts`, real PG16) — all green:
- ✓ persists a balanced TOPUP with natural-sign `balance_after`
- ✓ TOPUP_SETTLE moves pending → available
- ✓ replays an identical key — no second posting, no second outbox
- ✓ rejects a reused key with a different payload (IdempotencyConflict)
- ✓ rejects a RESERVE that overdraws available (InsufficientFunds), balance unchanged
- ✓ serializes concurrent RESERVEs on one wallet — exactly one wins (no lost update)

Unit: `balance.spec.ts` (naturalDelta per acct type/direction; overdraft predicate).

## 3. Migration impact analysis

**None.** A4 adds no schema and no migration (`migrate` still applies exactly `01..09`,
verified). A4 only INSERTs into the A1 tables (`ledger_transactions`, `ledger_postings`,
`outbox`) — append-only and double-entry guarantees are untouched; the A1 deferred balanced
trigger remains the final backstop (exercised by the integration suite).

## 4. Invariants & requirements preserved

| Requirement | How |
|---|---|
| ADRs / money model / chart / reconciliation | unchanged; A4 is a write adapter over the A1/A2/A3 model |
| Append-only (C4) | INSERT-only; A1 trigger + REVOKE intact |
| Double-entry (C3) | A3 intents balanced; A1 deferred trigger backstop at COMMIT |
| Idempotency (C5) | `idempotency_key UNIQUE` + replay; retries never double-post/emit |
| Auditability (C6) | `correlation_id` persisted + folded into the outbox envelope |
| Posting rules (A3) | consumed unchanged |
| Chart of accounts (A2) | no change; accounts resolved via A2 only |

## 5. Notable decisions (documented in `A4_POST_TRANSACTION.md`)
- **Advisory lock** on `account_id`, sorted → deadlock-free serialization.
- **Overdraft** scoped to `owner_type='user'` (wallet sub-accounts ≥0).
- **`balance_after`** is the account's natural-sign running balance.
- **`posted.v2`** encodes kip as **decimal strings** (BIGINT precision, rule #1); v1 stays
  valid; aggregate id is the moving user (wallet ordering) → else first owner → else sentinel.
- Inbox/DLQ consume-side and the wallet projection are **A6/A7**, not A4.

## 6. GO / NO-GO (A4)
**🟢 GO — A4 complete.** The write path persists balanced double-entry transactions with
idempotent replay, deadlock-free concurrency, overdraft protection, natural-sign balances,
and `posted.v2` emission — all verified at unit + DB-integration level on PG16. No migration;
lint/build green; committed on branch; unused by live flows (safe). A5 readiness in
`A5_READINESS_REVIEW.md`.
