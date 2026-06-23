-- ============================================================================
-- rollback_09_accounts_chart.sql  (manual rollback for migration 09)
-- NOT a numbered migration (lives under tests/ so the runner never auto-applies
-- it). Run by hand via psql to reverse 09_accounts_chart.sql.
--
--   psql -v ON_ERROR_STOP=1 -f infra/db/init/tests/rollback_09_accounts_chart.sql "$DATABASE_URL"
--
-- Safe while A2 is pre-live: no ledger_postings reference these accounts yet. The
-- singleton delete is guarded by NOT EXISTS, so it no-ops if anything posted.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DROP TRIGGER  IF EXISTS trg_accounts_enforce_kind ON accounts;
DROP FUNCTION IF EXISTS smartwash_accounts_enforce_kind();
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_kind_fk;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_natural_key;

-- Restore A1's original (NULL-distinct) 5-column unique constraint.
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_acct_type_owner_type_owner_id_sub_currency_key
    UNIQUE (acct_type, owner_type, owner_id, sub, currency);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Remove seeded singletons only if nothing posted against them (A2 is pre-live).
DELETE FROM accounts a
  WHERE a.owner_type IN ('platform','tax') AND a.owner_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM ledger_postings p WHERE p.account_id = a.id);

DROP TABLE IF EXISTS account_kinds;

-- Let the migrate runner re-apply 09 on a subsequent `nx run db:migrate`.
DELETE FROM schema_migrations WHERE filename = '09_accounts_chart.sql';

COMMIT;
