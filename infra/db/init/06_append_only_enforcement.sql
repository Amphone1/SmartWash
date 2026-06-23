-- ============================================================================
-- 06_append_only_enforcement.sql
-- Enforces non-negotiable rule #2 (append-only) at the DATABASE layer for the
-- immutable financial / history tables. The application already only INSERTs
-- into these tables; this makes UPDATE/DELETE impossible even via a bug, a
-- rogue query, or a future code change.
--
-- SAFETY (per approval condition):
--   • This script CREATES guardrails only. It does NOT modify, rewrite, or
--     delete any existing row. No DML against historical financial records.
--   • Idempotent: safe to re-run (DROP TRIGGER IF EXISTS before CREATE).
--   • Mutable snapshot/cache tables (machine_status, wallets) are intentionally
--     EXCLUDED — they are caches, not append-only ledgers.
--   • When the double-entry model lands (ADR-0003), add ledger_transactions and
--     ledger_postings to the array below.
-- ============================================================================

CREATE OR REPLACE FUNCTION smartwash_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not permitted (rule #2)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- BEFORE UPDATE OR DELETE triggers on each append-only table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_entries','audit_log','order_events','machine_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_append_only ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_append_only
         BEFORE UPDATE OR DELETE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION smartwash_block_mutation();', t);
  END LOOP;
END $$;

-- Defense in depth: remove UPDATE/DELETE privilege from the application role.
-- INSERT/SELECT remain intact. Resilient if the role name differs in an env.
DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE, DELETE ON ledger_entries, audit_log, order_events, machine_events FROM smartwash';
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'role "smartwash" not present; REVOKE skipped (triggers still enforce append-only)';
END $$;
