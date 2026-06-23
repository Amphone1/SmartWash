# A1_A2_COMPLETION_REPORT.md — EPIC A increments A1 + A2

> Completion evidence for the double-entry **A1** (schema) and **A2** (chart of accounts +
> `resolveAccount()`) increments. Generated 2026-06-19. **Read-only report — no source
> changed by this document.** Companion: `A3_READINESS_REVIEW.md`.
> Branch: **`epic-a/a2-accounts`** (6 commits, not pushed). Working tree clean.

## 1. Exact files changed

### R-1 fix — `56aaea3` (migration immutability)
| File | ± |
|---|---|
| `infra/db/init/08_rbac_machine_view.sql` (new forward migration) | +25 |

*(In-place edits to `01_schema.sql` and `02_rbac_seed.sql` were reverted to HEAD — no
committed diff. `01`'s `user_roles` change was redundant with migration `03`; `02`'s
`machine.view` delta is re-expressed in `08`.)*

### A1 — `c6e13ad` (money foundation migrations)
| File | ± |
|---|---|
| `infra/db/init/05_rbac_hardening.sql` | +30 |
| `infra/db/init/06_append_only_enforcement.sql` | +48 |
| `infra/db/init/07_double_entry_ledger.sql` | +108 |
| `infra/db/init/tests/07_double_entry_ledger.verify.sql` | +96 |
| **Total** | **4 files, +282** |

### A2 — `b56cbbd` (chart of accounts + resolveAccount)
| File | ± | Kind |
|---|---|---|
| `infra/db/init/09_accounts_chart.sql` | +117 | new (migration) |
| `infra/db/init/tests/09_accounts_chart.verify.sql` | +133 | new (DB test) |
| `infra/db/init/tests/rollback_09_accounts_chart.sql` | +37 | new (rollback) |
| `infra/db/init/tests/07_double_entry_ledger.verify.sql` | +4/-2 | mod (fixture fix) |
| `services/ledger/src/domain/accounts.ts` | +150 | new (pure) |
| `services/ledger/src/domain/accounts.spec.ts` | +123 | new (unit) |
| `services/ledger/src/domain/ports.ts` | +19 | mod (port) |
| `services/ledger/src/infra/db/pg-account.repository.ts` | +73 | new (resolver) |
| `services/ledger/src/infra/db/pg-account.repository.spec.ts` | +113 | new (test) |
| `services/ledger/src/app.module.ts` | +6/-2 | mod (DI) |
| `libs/common/src/lib/errors.ts` | +21 | mod (3 errors) |
| `docs/design/FINANCIAL_CONTRACT.md` | +13/-2 | mod (v1.1) |
| `.github/workflows/ci.yml` | +3 | mod (A2 verify) |
| `docs/audit/REMEDIATION_PLAN.md` | +4/-2 | mod (A2 → ✅) |
| **Total** | **14 files, +810 / -6** | |

*(Design/audit docs — ADRs 0002-0008, `MONEY_*`, `A2_ACCOUNTS_DESIGN.md`, `A2_REVIEW.md`,
the status trio — were committed in `63e86f8`/`246f244`; the Flutter app + service WIP in
`9f42ab8`. See `PROJECT_STATUS_REPORT.md`.)*

## 2. Migration execution results

Run against a throwaway **PG16** (`timescale/timescaledb:latest-pg16`, identical to CI), via
`nx run db:migrate` (the same checksum-locked runner CI uses).

| Check | Result |
|---|---|
| `migrate` on fresh DB (`01`→`09`) | **9 applied, 0 errors** |
| `schema_migrations` recorded | `01..09` (all nine, in order) |
| Re-run migrate (immutability) | **0 applied, 9 skipped** (checksum-stable — R-1 restored) |
| Direct re-apply `09` ×2 (idempotent) | **rc=0** (after fixing a `duplicate_table` handler gap) |
| Rollback `rollback_09_*.sql` | **rc=0** → `account_kinds` dropped, singletons removed, `schema_migrations` row cleared |
| Re-migrate after rollback | `09` re-applied (1 applied, 8 skipped) |
| **A1 verify (`07`)** | **6 / 6 PASS**, rc=0 (balanced accept · unbalanced reject · append-only UPDATE/DELETE blocked · dup idempotency_key · amount>0) |
| **A2 verify (`09`)** | **10 / 10 PASS**, rc=0 (singletons seeded · ON CONFLICT dedup [F1] · dup singleton `unique_violation` · entity NULL owner rejected · singleton w/owner rejected · wrong acct_type rejected · vendor FK-rejected · get-or-create idempotent · status UPDATE ok · identity UPDATE blocked) |

## 3. Test results

| Target | Result |
|---|---|
| `nx test ledger` | **34 tests / 4 suites PASS** (incl. `accounts.spec` 14, `pg-account.repository.spec` 7) |
| `nx test common` | **19 PASS** |
| `nx build ledger` | success (tsc → esbuild) |
| `nx lint ledger` | clean (`--max-warnings 0`) |
| `nx lint common` | clean |

## 4. Schema diff summary

**A1 (`07`) — additive, off live money path:**
- ENUM types: `acct_type`, `acct_owner` (incl. reserved `vendor`/`franchise`), `posting_dir`, `ledger_txn_type`
- Tables: `accounts`, `ledger_transactions` (`idempotency_key UNIQUE NOT NULL`), `ledger_postings`, `wallet_balances`
- Indexes: `idx_postings_txn`, `idx_postings_account(account_id, id DESC)`
- Guards: deferred constraint trigger `smartwash_assert_balanced` (ΣDR=ΣCR); append-only triggers + `REVOKE UPDATE,DELETE` on `ledger_transactions`/`ledger_postings`

**A2 (`09`) — additive + one constraint swap on (empty) `accounts`:**
- New table `account_kinds` (PK `(owner_type, sub)`; 11 catalogued kinds; source of truth for `acct_type` + `singleton`)
- `accounts` natural key: **dropped** A1's auto-named 5-col unique → **added** `accounts_natural_key UNIQUE NULLS NOT DISTINCT (owner_type, owner_id, sub, currency)` (`acct_type` removed from identity)
- `accounts_kind_fk` FK → `account_kinds`; trigger `trg_accounts_enforce_kind` (acct_type match · singleton↔owner_id · identity immutability)
- Seed: 3 platform/tax singletons (`bank:platform`, `suspense:platform`, `vat:tax`)
- **Verified post-state — `accounts` constraints:** `accounts_pkey` (p), `accounts_natural_key` (u), `accounts_kind_fk` (f) — *no* leftover A1 unique (drop-loop confirmed).

**R-1 (`08`) — non-money:** permission `machine.view` + grants (staff/owner/admin).

## 5. Financial-contract diff summary

`docs/design/FINANCIAL_CONTRACT.md` **v1.0 → v1.1** (commit `b56cbbd`, +13/-2):
- Added `> **Version:** 1.1 (2026-06-19)` header line.
- §7 error model: **added `AccountInactive(409)`** (resolved account exists but not `active`;
  `resolveAccount()` raises rather than silently reactivating).
- Added `## Changelog` (1.1 entry + 1.0 baseline).
- **No change** to money model, chart of accounts, posting rules, invariants (§8), or
  reconciliation. *(Known doc-hygiene nit — see §7: the status line still reads "NO-GO
  active", stale since the 2026-06-17 lift.)*

## 6. Remaining NO-GO items

Program-level **NO-GO was lifted 2026-06-17**; money work proceeds STOP-and-ask per
increment. Original audit BLOCKERs status:

| Blocker | Status | Closes at |
|---|---|---|
| **B2** append-only convention-only | ✅ **closed** | `06` (ADR-0002) |
| **B1** single-entry ledger | 🟡 **in progress** — schema delivered (A1+A2); not on a live money path until per-flow cutover | A5→A9 |
| **B3** single wallet balance (no reserve/hold/pending) | ⬜ open — `wallet_balances` table exists; projection not built | A7 |
| **B4** no branch/platform sub-ledgers / L2-L3 recon | ⬜ open — account kinds (bank/clearing/suspense/revenue) now exist; recon jobs not built | EPIC C |

**None block A3** (A3 is pure rules, off the live money path).

## 7. Open audit findings

- **A2_REVIEW F1–F13:** ✅ **all closed** (verified at DB + unit level — §2/§3).
- **`CONSISTENCY_REPORT.md` (still open):** BUILD_PLAN stale (EPIC F); API contract coverage —
  6 missing OpenAPI specs incl. 4-balance wallet (EPIC F); `owner_account` env↔per-branch
  ambiguity (design resolved to per-branch; code at EPIC C); `LedgerPosted` needs **v2**
  (additive: account + post-balance) (EPIC D / A6-A7).
- **H1** wallet projection is LWW (stale-balance risk) → A7 monotonic `last_txn_id`.
- **H5** no RLS / universal branch filter → EPIC F.
- **Doc hygiene (R-3):** ADR-0003/0004/0007, `CONSISTENCY_REPORT.md`, and `FINANCIAL_CONTRACT.md`
  status line still say "gated by / NO-GO active" — stale since the lift. Non-blocking.

**None of the above block A3.** A3-relevant prerequisites are tracked in `A3_READINESS_REVIEW.md`.
