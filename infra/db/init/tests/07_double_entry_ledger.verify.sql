-- ============================================================================
-- 07_double_entry_ledger.verify.sql  (A1 DB integration test)
-- Verifies the invariants added by 07_double_entry_ledger.sql against a real
-- Postgres (PG16). All work runs in ONE transaction that ROLLBACKs at the end,
-- so it leaves ZERO residue — required because ledger_postings is append-only
-- (committed test rows could never be deleted).
--
-- Run:  psql -v ON_ERROR_STOP=1 -f infra/db/init/tests/07_double_entry_ledger.verify.sql "$DATABASE_URL"
-- A failed assertion RAISEs and aborts with a non-zero exit (CI-friendly).
-- (CI wiring as a post-migrate step is proposed separately — CI config is
--  STOP-and-ask per CLAUDE.md, so it is not added here.)
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- Fixtures (rolled back).
INSERT INTO users (id, phone, name)
  VALUES ('00000000-0000-0000-0000-0000000000aa', '+85620VERIFY01', 'verify-user');
INSERT INTO accounts (id, acct_type, owner_type, owner_id, sub) VALUES
  (900001, 'LIABILITY', 'user',   '00000000-0000-0000-0000-0000000000aa', 'available'),
  (900002, 'ASSET',     'branch', NULL, 'clearing');

-- 1) Balanced transaction is accepted.
DO $$
BEGIN
  INSERT INTO ledger_transactions (id, type, idempotency_key)
    VALUES (900001, 'TOPUP', 'verify:balanced');
  INSERT INTO ledger_postings (txn_id, account_id, direction, amount, balance_after) VALUES
    (900001, 900002, 'DR', 5000, 5000),
    (900001, 900001, 'CR', 5000, 5000);
  SET CONSTRAINTS ALL IMMEDIATE;          -- force the deferred balanced check now
  RAISE NOTICE 'PASS 1: balanced transaction accepted';
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- 2) Unbalanced transaction is rejected (DR only).
DO $$
BEGIN
  BEGIN
    INSERT INTO ledger_transactions (id, type, idempotency_key)
      VALUES (900002, 'ADJUSTMENT', 'verify:unbalanced');
    INSERT INTO ledger_postings (txn_id, account_id, direction, amount, balance_after)
      VALUES (900002, 900002, 'DR', 7000, 7000);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FAIL 2: unbalanced transaction was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2: unbalanced transaction rejected';
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- 3) Append-only: UPDATE and DELETE are blocked.
DO $$
BEGIN
  BEGIN
    UPDATE ledger_postings SET amount = 1 WHERE txn_id = 900001;
    RAISE EXCEPTION 'FAIL 3a: UPDATE on ledger_postings allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'PASS 3a: UPDATE on ledger_postings blocked';
  END;
  BEGIN
    DELETE FROM ledger_transactions WHERE id = 900001;
    RAISE EXCEPTION 'FAIL 3b: DELETE on ledger_transactions allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'PASS 3b: DELETE on ledger_transactions blocked';
  END;
END $$;

-- 4) idempotency_key is UNIQUE (duplicate of the still-pending key from test 1).
DO $$
BEGIN
  BEGIN
    INSERT INTO ledger_transactions (id, type, idempotency_key)
      VALUES (900003, 'TOPUP', 'verify:balanced');
    RAISE EXCEPTION 'FAIL 4: duplicate idempotency_key accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS 4: duplicate idempotency_key rejected';
  END;
END $$;

-- 5) Posting amount must be > 0.
DO $$
BEGIN
  BEGIN
    INSERT INTO ledger_transactions (id, type, idempotency_key)
      VALUES (900004, 'TOPUP', 'verify:amount');
    INSERT INTO ledger_postings (txn_id, account_id, direction, amount, balance_after)
      VALUES (900004, 900001, 'DR', 0, 0);
    RAISE EXCEPTION 'FAIL 5: amount <= 0 accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 5: amount <= 0 rejected';
  END;
END $$;

ROLLBACK;   -- zero residue
