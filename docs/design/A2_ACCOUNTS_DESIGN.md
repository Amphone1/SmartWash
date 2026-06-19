# A2 — Chart of Accounts + `resolveAccount()` (revised design + Migration 08 proposal)

> **Status: APPROVED — implemented 2026-06-19.** Shipped as migration
> **`09_accounts_chart.sql`** (slot `08` was taken by the R-1 RBAC forward migration
> `08_rbac_machine_view.sql`); the design below is unchanged — any reference to
> "Migration 08" means **09**. The DDL proposed here is now the live migration.
> Resolves the NO-GO findings in `docs/audit/A2_REVIEW.md` (F1–F13).
> Implements ADR-0003 (chart of accounts), preserves ADR-0006 (vendor/franchise reserved),
> feeds ADR-0007 (reconciliation). Builds additively on A1 (`07_double_entry_ledger.sql`).
>
> Conventions: money is `BIGINT` kip; currency pinned `LAK` (multi-currency reserved).

---

## 1. Decisions (resolving the A2_REVIEW findings)

| # | Decision | Closes |
|---|---|---|
| D1 | Natural key = `(owner_type, owner_id, sub, currency)` with **`NULLS NOT DISTINCT`** (PG16). `acct_type` is **removed from identity**. | F1, F2 |
| D2 | New catalog table **`account_kinds(owner_type, sub) → acct_type, singleton`** is the single source of legal accounts; `accounts` FKs to it and a trigger validates `acct_type` + `owner_id` presence. `sub` is no longer free-form in practice. | F2, F3, F13 |
| D3 | ONE canonical account-key grammar: **`{sub}:{owner_type}:{owner_id|"_"}`**. `resolveAccount()` is the sole producer/parser. | F4 |
| D4 | `tax:vat` → `owner_type=tax, owner_id=NULL, sub='vat'`. The `platform` reading is dropped. | F5 |
| D5 | `payable` owner identity = **`users.id`** (the person). Driver → user via `drivers.user_id`. | F6 |
| D6 | Migration **seeds only platform singletons**; entity accounts are **lazily get-or-created** by `resolveAccount()` (concurrency-safe upsert). | F7 |
| D7 | `resolveAccount()` **auto-creates** valid entity accounts; `AccountNotFound` is reserved for unknown kind / unknown owner_type / non-existent owner; inactive existing account → `AccountInactive`. | F8 |
| D8 | `resolveAccount()` validates the **owner entity exists** per owner_type before create. | F9 |
| D9 | Inter-branch `due-from`/`due-to` are **deferred to EPIC C** — not registered in `account_kinds`, so the resolver fails closed on them. | F10 |
| D10 | `vendor`/`franchise` remain enum values with **no `account_kinds` rows** → rejected by both the resolver (in-code) and the DB FK (defense in depth). | F11 |
| D11 | `currency` defaults and is **pinned to `'LAK'`**; non-LAK → `CurrencyMismatch`. | F12 |

---

## 2. Updated ERD

```
account_kinds                         -- NEW: catalog of every LEGAL account kind
  owner_type  acct_owner  PK\
  sub         TEXT        PK/ (composite PK)
  acct_type   acct_type   NOT NULL    -- intrinsic type for this kind
  singleton   BOOLEAN     NOT NULL    -- TRUE → owner_id MUST be NULL; FALSE → MUST be NOT NULL
  description TEXT        NOT NULL
        ▲
        │ FK (owner_type, sub)            + BEFORE-trigger validates acct_type & owner_id rule
        │
accounts                              -- A1 table, natural key REPLACED in Migration 08
  id          BIGSERIAL  PK            -- surrogate (unchanged)
  acct_type   acct_type  NOT NULL      -- denormalized, FK+trigger-validated == account_kinds.acct_type
  owner_type  acct_owner NOT NULL  \
  owner_id    UUID                  |   natural key:
  sub         TEXT       NOT NULL   |   UNIQUE NULLS NOT DISTINCT (owner_type, owner_id, sub, currency)
  currency    TEXT       'LAK'      /
  status      TEXT       'active'      -- active|closed (only status/updated_at mutable; identity immutable)
  created_at  TIMESTAMPTZ
        ▲
        │ FK account_id
        │
ledger_postings  (A1, unchanged)   ──┐ txn_id
ledger_transactions (A1, unchanged) ◄┘   id, type, correlation_id, idempotency_key UNIQUE
wallet_balances  (A1, unchanged)         user_id PK, available/reserved/held/pending, last_txn_id
```

Mapping note (for A7): a user has **four** `accounts` rows (LIABILITY: available/reserved/
held/pending); the wallet projector folds them into the **one** `wallet_balances` row.

---

## 3. `account_kinds` catalog (the full legal set for A2)

| owner_type | sub | acct_type | singleton | canonical key | seeded? |
|---|---|---|---|---|---|
| platform | bank | ASSET | ✔ | `bank:platform:_` | ✔ seed |
| platform | suspense | ASSET | ✔ | `suspense:platform:_` | ✔ seed |
| tax | vat | LIABILITY | ✔ | `vat:tax:_` | ✔ seed |
| user | available | LIABILITY | ✗ | `available:user:{u}` | lazy |
| user | reserved | LIABILITY | ✗ | `reserved:user:{u}` | lazy |
| user | held | LIABILITY | ✗ | `held:user:{u}` | lazy |
| user | pending | LIABILITY | ✗ | `pending:user:{u}` | lazy |
| branch | bank | ASSET | ✗ | `bank:branch:{b}` | lazy |
| branch | clearing | ASSET | ✗ | `clearing:branch:{b}` | lazy |
| branch | revenue | REVENUE | ✗ | `revenue:branch:{b}` | lazy |
| staff | payable | LIABILITY | ✗ | `payable:staff:{userId}` | lazy |

Deferred / rejected (not in catalog): `vendor:*`, `franchise:*` (ADR-0006 reserved),
`due-from:*`/`due-to:*` (EPIC C). The resolver fails closed on all of them.

### Old-chart → canonical key normalization (traceability)

| Old (`MONEY_MODEL_PROPOSED.md §3`) | Canonical | Notes |
|---|---|---|
| `wallet:available:{u}` … `wallet:pending:{u}` | `{sub}:user:{u}` | drop `wallet:` prefix |
| `bank:branch:{b}` / `clearing:branch:{b}` / `revenue:branch:{b}` | unchanged form `{sub}:branch:{b}` | |
| `bank:platform` | `bank:platform:_` | singleton |
| `suspense:topup` | `suspense:platform:_` | `sub='suspense'`; finer buckets = future subs |
| `tax:vat` | `vat:tax:_` | owner_type=`tax` (D4) |
| `payable:staff:{d}` | `payable:staff:{userId}` | owner = `users.id` (D5) |

---

## 4. Natural key definition

- **Identity (business/natural key):** `(owner_type, owner_id, sub, currency)`,
  enforced by `UNIQUE NULLS NOT DISTINCT` so a singleton's `owner_id = NULL` is a single
  value (fixes the F1 duplication hole).
- **`acct_type` is NOT in the identity.** It is functionally determined by `(owner_type, sub)`
  via `account_kinds`, denormalized onto `accounts` for fast L3 grouping, and kept truthful
  by FK + trigger.
- **Surrogate key:** `accounts.id BIGSERIAL` (unchanged from A1; what postings reference).
- **Canonical string key (`accountKey`)** for events/logs: `{sub}:{owner_type}:{owner_id|"_"}`
  e.g. `available:user:7c…`, `vat:tax:_`. Reserved extension: `@{currency}` suffix when
  currency ≠ LAK (not emitted today).

---

## 5. `resolveAccount()` contract

Location: `services/ledger` (or `libs/nestkit` if shared). Pure get-or-create over `accounts`.

```ts
type AllowedOwner = 'user' | 'branch' | 'platform' | 'staff' | 'tax';   // vendor/franchise rejected

interface AccountRef {
  ownerType: AllowedOwner;
  sub: string;            // canonical sub (from the catalog mirror)
  ownerId?: string;       // UUID; required iff kind.singleton === false; absent for singletons
  currency?: string;      // default 'LAK'
}

interface ResolvedAccount { id: bigint; acctType: AcctType; accountKey: string; }

// MUST run inside the caller's DB transaction so create+post are atomic (C2/C5).
resolveAccount(ref: AccountRef, tx: PoolClient): Promise<ResolvedAccount>;
```

**Algorithm (deterministic, fail-closed):**
1. `currency = ref.currency ?? 'LAK'`; if `currency !== 'LAK'` → `CurrencyMismatch` (D11).
2. Reject `ownerType ∉ AllowedOwner` (incl. vendor/franchise) → `AccountNotFound` (D10).
3. Look up `(ownerType, sub)` in the **in-code catalog mirror** of `account_kinds` →
   `{ acctType, singleton }`. Miss → `AccountNotFound` (D7) — never invents a kind.
4. Validate owner-id shape: `singleton` ⇒ `ownerId` MUST be absent; non-singleton ⇒
   `ownerId` present and `isUuid()` → else `ValidationError`.
5. **Owner existence (D8):** non-singleton → assert the entity row exists
   (`user`→`users.id`, `branch`→`branches.id`, `staff`→`users.id`). Missing → `AccountNotFound`.
6. **Concurrency-safe upsert** (idempotent create — the A2 gate):
   ```sql
   INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
   VALUES ($1,$2,$3,$4,$5,'active')
   ON CONFLICT ON CONSTRAINT accounts_natural_key
     DO UPDATE SET status = accounts.status          -- no-op so RETURNING yields the existing row
   RETURNING id, acct_type, status;
   ```
   (`DO NOTHING` would not return the conflicting row; the no-op `DO UPDATE` does, and the
   `NULLS NOT DISTINCT` constraint makes this safe for singletons.)
7. If returned `status <> 'active'` → `AccountInactive` (no silent reactivation).
8. Return `{ id, acctType, accountKey: \`${sub}:${ownerType}:${ownerId ?? '_'}\` }`.

**Error mapping (aligns with `FINANCIAL_CONTRACT.md §7`):**
`ValidationError(400)` · `CurrencyMismatch(422)` · `AccountNotFound(404)` (unknown kind /
owner_type / non-existent owner) · **`AccountInactive(409)`** *(new — flag for the canonical
error-set/contract update)*.

**Idempotency:** resolveAccount is naturally idempotent (find-or-create); it does **not**
own ledger-transaction idempotency (that is `ledger_transactions.idempotency_key`, A3/A4).
Replays of the same ref return the same `accounts.id`.

**Helpers (single source for the grammar):** `buildAccountKey(ref)` and
`parseAccountKey(str)` so producers (postings/events) and the A7 projector share one parser.

---

## 6. Migration 08 — DDL proposal

> Re-runnable / idempotent (mirrors the style of `06`/`07`). Shown for review only;
> not placed in `infra/db/init/`. Proposed filename when approved: `08_accounts_chart.sql`.

```sql
-- ============================================================================
-- 08_accounts_chart.sql  (EPIC A · increment A2)
-- Catalog of legal account kinds + corrected accounts natural key + singleton seed.
-- ADDITIVE: introduces account_kinds, swaps the unsafe A1 unique constraint, and
-- seeds ONLY platform singletons. Touches no postings/transactions. A2 is pre-live.
-- Depends on 07_double_entry_ledger.sql.
-- ============================================================================

-- 1) Catalog of legal account kinds.
CREATE TABLE IF NOT EXISTS account_kinds (
  owner_type  acct_owner NOT NULL,
  sub         TEXT       NOT NULL,
  acct_type   acct_type  NOT NULL,
  singleton   BOOLEAN    NOT NULL,
  description TEXT       NOT NULL,
  PRIMARY KEY (owner_type, sub)
);

INSERT INTO account_kinds (owner_type, sub, acct_type, singleton, description) VALUES
  ('platform','bank',     'ASSET',     true,  'Platform settlement cash'),
  ('platform','suspense', 'ASSET',     true,  'Unmatched / orphan receipts'),
  ('tax',     'vat',      'LIABILITY', true,  'VAT payable (basis points)'),
  ('user',    'available','LIABILITY', false, 'Spendable wallet'),
  ('user',    'reserved', 'LIABILITY', false, 'Committed to in-flight wash'),
  ('user',    'held',     'LIABILITY', false, 'Authorization hold (delivery)'),
  ('user',    'pending',  'LIABILITY', false, 'Provisional top-up (pre-recon)'),
  ('branch',  'bank',     'ASSET',     false, 'Confirmed cash at branch bank'),
  ('branch',  'clearing', 'ASSET',     false, 'Claimed top-ups awaiting bank match'),
  ('branch',  'revenue',  'REVENUE',   false, 'Wash fees (net of VAT)'),
  ('staff',   'payable',  'LIABILITY', false, 'Payout owed to staff/driver (owner_id = users.id)')
ON CONFLICT (owner_type, sub) DO NOTHING;
-- vendor/franchise: intentionally absent (ADR-0006). due-from/due-to: deferred (EPIC C).

-- 2) Replace the unsafe A1 natural key (drops acct_type from identity; NULL-safe).
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_acct_type_owner_type_owner_id_sub_currency_key;
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_natural_key
    UNIQUE NULLS NOT DISTINCT (owner_type, owner_id, sub, currency);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'accounts_natural_key already present; skipped';
END $$;

-- 3) FK accounts -> account_kinds (only catalogued kinds may exist).
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_kind_fk
    FOREIGN KEY (owner_type, sub) REFERENCES account_kinds (owner_type, sub);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'accounts_kind_fk already present; skipped';
END $$;

-- 4) Validate acct_type match + singleton/owner_id rule; freeze identity columns.
CREATE OR REPLACE FUNCTION smartwash_accounts_enforce_kind() RETURNS trigger AS $$
DECLARE k account_kinds%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_type <> OLD.owner_type OR NEW.sub <> OLD.sub
       OR NEW.currency <> OLD.currency OR NEW.acct_type <> OLD.acct_type
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'account identity is immutable (id %)', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;                       -- only status / updated_at may change
  END IF;
  SELECT * INTO k FROM account_kinds WHERE owner_type = NEW.owner_type AND sub = NEW.sub;
  IF NEW.acct_type <> k.acct_type THEN
    RAISE EXCEPTION 'acct_type % invalid for %/% (expected %)',
      NEW.acct_type, NEW.owner_type, NEW.sub, k.acct_type USING ERRCODE = 'check_violation';
  END IF;
  IF k.singleton AND NEW.owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'singleton %/% must have NULL owner_id', NEW.owner_type, NEW.sub
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT k.singleton AND NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'entity account %/% requires owner_id', NEW.owner_type, NEW.sub
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_enforce_kind ON accounts;
CREATE TRIGGER trg_accounts_enforce_kind
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION smartwash_accounts_enforce_kind();

-- 5) Seed ONLY platform singletons (idempotent; entity accounts are lazy via resolveAccount).
INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status) VALUES
  ('ASSET',     'platform', NULL, 'bank',     'LAK', 'active'),
  ('ASSET',     'platform', NULL, 'suspense', 'LAK', 'active'),
  ('LIABILITY', 'tax',      NULL, 'vat',      'LAK', 'active')
ON CONFLICT ON CONSTRAINT accounts_natural_key DO NOTHING;
```

A companion `infra/db/init/tests/08_accounts_chart.verify.sql` is proposed (one rolled-back
transaction, CI-friendly) asserting: (a) singleton dup is deduped via `ON CONFLICT`;
(b) entity account with NULL owner_id is rejected; (c) singleton with non-NULL owner_id is
rejected; (d) wrong `acct_type` for a kind is rejected; (e) an un-catalogued kind (e.g.
`vendor`) is rejected by the FK; (f) identity-column UPDATE is rejected. Written when approved.

---

## 7. Rollback plan

> Proposed `rollback_08_accounts_chart.sql`. Safe because A2 is **pre-live** — no
> `ledger_postings` reference these accounts yet (the `NOT EXISTS` guard makes the seed
> delete a no-op if any posting somehow exists, and the FK would block it regardless).

```sql
BEGIN;
DROP TRIGGER  IF EXISTS trg_accounts_enforce_kind ON accounts;
DROP FUNCTION IF EXISTS smartwash_accounts_enforce_kind();
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_kind_fk;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_natural_key;

-- restore A1's original (NULL-distinct) constraint
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_acct_type_owner_type_owner_id_sub_currency_key
    UNIQUE (acct_type, owner_type, owner_id, sub, currency);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- remove seeded singletons only if nothing posted against them (A2 is pre-live)
DELETE FROM accounts a
  WHERE a.owner_type IN ('platform','tax') AND a.owner_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM ledger_postings p WHERE p.account_id = a.id);

DROP TABLE IF EXISTS account_kinds;
COMMIT;
```

Rollback order matters: drop trigger/FK **before** dropping `account_kinds` and before the
constraint swap. Reversal is total while pre-live; once live, prefer a forward-only fix.

---

## 8. Compatibility analysis with A1 (`07_double_entry_ledger.sql`)

| A1 artifact | Effect of A2 / Migration 08 | Verdict |
|---|---|---|
| `accounts` table | Natural-key constraint **swapped** (drop A1's 5-col UNIQUE → `accounts_natural_key`); FK + trigger **added**; `acct_type` column **kept** (now FK/trigger-validated, denormalized for L3) | ✅ additive + one constraint swap; safe pre-live |
| `ledger_transactions` / `ledger_postings` | **Untouched.** Balanced-trigger and append-only guards intact | ✅ |
| `wallet_balances` | **Untouched.** resolveAccount makes the 4 user LIABILITY accounts; A7 projector aggregates to the 1 wallet row | ✅ (mapping documented for A7) |
| Enum types `acct_type` / `acct_owner` | **Reused as-is.** No new enum values; `vendor`/`franchise` already present, simply not catalogued | ✅ |
| `idempotency_key UNIQUE NOT NULL` (A1) | Unaffected; remains the A3/A4 backstop | ✅ |
| `idx_postings_account (account_id, id DESC)` | Still serves `balance_after` reads for posting callers | ✅ |
| **A1 `verify.sql` fixture** (line 21–22: `('ASSET','branch',NULL,'clearing')`) | **Becomes invalid** under A2 — a branch (non-singleton) account with NULL owner_id is now rejected by the trigger | ⚠️ **Required follow-up:** when implementing, update that fixture to pass a real branch `owner_id` (it was an invalid fixture; this is the F1 hole made concrete). Not changed here. |
| Sequencing | Migration 08 MUST precede A3/A4 (resolver upsert targets `accounts_natural_key`); init-scripts run once on first boot, so this ships as a **new** file, never by editing `07` | ✅ |

**Net:** A2 sits cleanly on A1. The only behavioral change to anything A1 produced is the
intended constraint correction, plus the one invalid A1 test fixture that must be fixed at
implementation time.

---

## 9. What this design does NOT do (kept out of A2, by decision)
- No posting/transaction-builder logic (that is **A3**).
- No `postTransaction()` repo, advisory locks, or `posted.v2` outbox (that is **A4**).
- No inter-branch `due-from`/`due-to` accounts (**EPIC C**).
- No vendor/franchise accounts or tenancy tables (**ADR-0006**, reserved).
- No changes to the live single-entry ledger (strangler-fig; legacy stays authoritative).

---

## 10. Review checklist (please confirm before implementation)
- [ ] Natural key `(owner_type, owner_id, sub, currency)` + `NULLS NOT DISTINCT` (D1/F1)
- [ ] `account_kinds` catalog contents (§3) — the legal account set
- [ ] Canonical key grammar `{sub}:{owner_type}:{owner_id|"_"}` (D3/F4)
- [ ] `tax:vat → owner_type=tax` (D4) and `payable → users.id` (D5)
- [ ] `resolveAccount()` algorithm + error mapping incl. new `AccountInactive(409)` (§5)
- [ ] Migration 08 DDL (§6) and rollback (§7)
- [ ] Accepted follow-up: fix the A1 `verify.sql` branch fixture at implementation time (§8)

*No files other than this proposal were created or modified. Stopping for review.*
