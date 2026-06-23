-- ============================================================================
-- 07_double_entry_ledger.sql  (EPIC A · increment A1)
-- Implements ADR-0003 (double-entry ledger), ADR-0004 (four-balance wallet),
-- ADR-0007 (accounts for reconciliation).
--
-- ADDITIVE ONLY: creates NEW tables/types/triggers. It touches NO existing row
-- and changes NO existing code path. Legacy single-entry `ledger_entries` and
-- `wallets` remain authoritative until the flagged per-flow cutover (A8).
--
-- Depends on 06_append_only_enforcement.sql (reuses smartwash_block_mutation()).
-- Vendor/franchise are reserved in the acct_owner enum (ADR-0006) but seeded with
-- no accounts and no logic.
-- ============================================================================

CREATE TYPE acct_type       AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE acct_owner      AS ENUM ('user','branch','platform','staff','tax','vendor','franchise');
CREATE TYPE posting_dir     AS ENUM ('DR','CR');
CREATE TYPE ledger_txn_type AS ENUM ('TOPUP','TOPUP_SETTLE','RESERVE','RELEASE','HOLD',
                                     'CAPTURE','REFUND_REVERSAL','ADJUSTMENT','SETTLEMENT');

-- Chart of accounts (see docs/design/MONEY_MODEL_PROPOSED.md §3).
CREATE TABLE accounts (
    id         BIGSERIAL PRIMARY KEY,
    acct_type  acct_type  NOT NULL,
    owner_type acct_owner NOT NULL,
    owner_id   UUID,                       -- NULL for platform singletons (tax:vat, suspense:topup)
    sub        TEXT NOT NULL,              -- available|reserved|held|pending|clearing|bank|revenue|...
    currency   TEXT NOT NULL DEFAULT 'LAK',
    status     TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (acct_type, owner_type, owner_id, sub, currency)
);

-- Journal header: one row per money movement (C5 idempotency backstop).
CREATE TABLE ledger_transactions (
    id              BIGSERIAL PRIMARY KEY,
    type            ledger_txn_type NOT NULL,
    correlation_id  TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only DR/CR lines. Sign is carried by direction; amount is positive.
CREATE TABLE ledger_postings (
    id            BIGSERIAL PRIMARY KEY,
    txn_id        BIGINT NOT NULL REFERENCES ledger_transactions(id),
    account_id    BIGINT NOT NULL REFERENCES accounts(id),
    direction     posting_dir NOT NULL,
    amount        BIGINT NOT NULL CHECK (amount > 0),
    balance_after BIGINT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_postings_txn     ON ledger_postings(txn_id);
CREATE INDEX idx_postings_account ON ledger_postings(account_id, id DESC);

-- Four-balance wallet projection (mutable cache; derived from postings — NOT append-only).
CREATE TABLE wallet_balances (
    user_id     UUID PRIMARY KEY REFERENCES users(id),
    available   BIGINT NOT NULL DEFAULT 0,
    reserved    BIGINT NOT NULL DEFAULT 0,
    held        BIGINT NOT NULL DEFAULT 0,
    pending     BIGINT NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'LAK',
    last_txn_id BIGINT NOT NULL DEFAULT 0,   -- monotonic guard (invariant W3; fixes H1)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invariant C3/L1: per transaction Σ DR = Σ CR. Deferred so an N-line transaction
-- inserted in any order is validated at COMMIT (or SET CONSTRAINTS ... IMMEDIATE).
CREATE OR REPLACE FUNCTION smartwash_assert_balanced() RETURNS trigger AS $$
DECLARE dr BIGINT; cr BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE direction = 'DR'), 0),
         COALESCE(SUM(amount) FILTER (WHERE direction = 'CR'), 0)
    INTO dr, cr
    FROM ledger_postings WHERE txn_id = NEW.txn_id;
  IF dr <> cr THEN
    RAISE EXCEPTION 'unbalanced ledger transaction %: DR % <> CR %', NEW.txn_id, dr, cr
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_ledger_postings_balanced
  AFTER INSERT ON ledger_postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION smartwash_assert_balanced();

-- Invariant C4/L2: append-only on the new immutable tables (reuses 06's function).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_transactions','ledger_postings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_append_only ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_append_only
         BEFORE UPDATE OR DELETE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION smartwash_block_mutation();', t);
  END LOOP;
END $$;

DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE, DELETE ON ledger_transactions, ledger_postings FROM smartwash';
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'role "smartwash" absent; REVOKE skipped (triggers still enforce append-only)';
END $$;
