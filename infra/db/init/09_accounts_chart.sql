-- ============================================================================
-- 09_accounts_chart.sql  (EPIC A · increment A2)
-- Catalog of legal account kinds + corrected accounts natural key + singleton seed.
-- Implements docs/design/A2_ACCOUNTS_DESIGN.md (resolves A2_REVIEW F1-F13).
--
-- ADDITIVE: introduces account_kinds, swaps the unsafe A1 unique constraint for a
-- NULL-safe natural key, adds an FK + validation trigger, and seeds ONLY platform
-- singletons. Touches no postings/transactions. A2 is pre-live (accounts empty).
-- Depends on 07_double_entry_ledger.sql. Idempotent / re-runnable.
-- (NB: slot 08 is 08_rbac_machine_view.sql; A2 ships as 09 — see the design doc.)
-- ============================================================================

-- 1) Catalog of legal account kinds (one row per (owner_type, sub)).
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
-- vendor/franchise intentionally NOT catalogued (ADR-0006) -> resolver + FK reject.
-- inter-branch due-from/due-to intentionally deferred to EPIC C.

-- 2) Replace the unsafe A1 natural key (drop acct_type from identity; NULL-safe).
--    Robust to constraint naming: drop any UNIQUE on accounts except our target.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'accounts'::regclass AND contype = 'u'
       AND conname <> 'accounts_natural_key'
  LOOP
    EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_natural_key
    UNIQUE NULLS NOT DISTINCT (owner_type, owner_id, sub, currency);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN
  -- duplicate_table covers the backing index name on a re-run
  RAISE NOTICE 'accounts_natural_key already present; skipped';
END $$;

-- 3) FK accounts -> account_kinds (only catalogued kinds may exist).
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_kind_fk
    FOREIGN KEY (owner_type, sub) REFERENCES account_kinds (owner_type, sub);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'accounts_kind_fk already present; skipped';
END $$;

-- 4) Validate acct_type match + singleton/owner_id rule; freeze identity on UPDATE.
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
    RETURN NEW;                       -- identity frozen; status/created_at may change
  END IF;
  SELECT * INTO k FROM account_kinds
    WHERE owner_type = NEW.owner_type AND sub = NEW.sub;
  IF NOT FOUND THEN
    RETURN NEW;                       -- let the FK reject an uncatalogued kind
  END IF;
  IF NEW.acct_type <> k.acct_type THEN
    RAISE EXCEPTION 'acct_type % invalid for %/% (expected %)',
      NEW.acct_type, NEW.owner_type, NEW.sub, k.acct_type
      USING ERRCODE = 'check_violation';
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

-- 5) Seed ONLY platform singletons (idempotent). Entity accounts (per user /
--    branch / staff) are created lazily by resolveAccount() (services/ledger).
INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status) VALUES
  ('ASSET',     'platform', NULL, 'bank',     'LAK', 'active'),
  ('ASSET',     'platform', NULL, 'suspense', 'LAK', 'active'),
  ('LIABILITY', 'tax',      NULL, 'vat',      'LAK', 'active')
ON CONFLICT ON CONSTRAINT accounts_natural_key DO NOTHING;
