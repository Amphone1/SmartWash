-- ============================================================================
-- a3_posting_rules.verify.sql  (A3 cross-layer verification)
-- Proves the A3 posting-rule SHAPES (multi-line, VAT-split) persist as balanced
-- double-entry transactions accepted by the A1 deferred balanced trigger and the
-- A2 account constraints. Mirrors the TS builders in
-- services/ledger/src/domain/posting-rules.ts (kept in sync by review).
--
-- Not a migration (lives under tests/). Runs in ONE rolled-back transaction.
-- Run: psql -v ON_ERROR_STOP=1 -f infra/db/init/tests/a3_posting_rules.verify.sql "$DATABASE_URL"
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO users (id, phone, name)
  VALUES ('00000000-0000-0000-0000-0000000000a3', '+85620VERIFYA3', 'verify-a3');

-- 1) CAPTURE shape: DR reserved (gross) / CR revenue (net) + CR vat — 3 lines, balanced.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000000a3';
  b uuid := '00000000-0000-0000-0000-0000000000b3';
  a_reserved bigint; a_revenue bigint; a_vat bigint; txn bigint;
BEGIN
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('LIABILITY','user',u,'reserved')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_reserved;
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('REVENUE','branch',b,'revenue')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_revenue;
  SELECT id INTO a_vat FROM accounts WHERE owner_type='tax' AND sub='vat' AND owner_id IS NULL;

  INSERT INTO ledger_transactions(type,idempotency_key) VALUES('CAPTURE','a3-verify:wash-deduct:o1') RETURNING id INTO txn;
  INSERT INTO ledger_postings(txn_id,account_id,direction,amount,balance_after) VALUES
    (txn,a_reserved,'DR',22000,0),
    (txn,a_revenue ,'CR',20000,0),
    (txn,a_vat     ,'CR', 2000,0);
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE NOTICE 'PASS A3-1: CAPTURE 3-line (DR gross / CR net + CR vat) balanced & accepted';
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- 2) TOPUP_SETTLE shape: 4 lines (bank/clearing + pending/available) — balanced.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000000a3';
  b uuid := '00000000-0000-0000-0000-0000000000b3';
  a_bank bigint; a_clearing bigint; a_pending bigint; a_available bigint; txn bigint;
BEGIN
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('ASSET','branch',b,'bank')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_bank;
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('ASSET','branch',b,'clearing')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_clearing;
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('LIABILITY','user',u,'pending')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_pending;
  INSERT INTO accounts(acct_type,owner_type,owner_id,sub) VALUES('LIABILITY','user',u,'available')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status=accounts.status RETURNING id INTO a_available;

  INSERT INTO ledger_transactions(type,idempotency_key) VALUES('TOPUP_SETTLE','a3-verify:topup-settle:o1') RETURNING id INTO txn;
  INSERT INTO ledger_postings(txn_id,account_id,direction,amount,balance_after) VALUES
    (txn,a_bank     ,'DR',50000,0),
    (txn,a_clearing ,'CR',50000,0),
    (txn,a_pending  ,'DR',50000,0),
    (txn,a_available,'CR',50000,0);
  SET CONSTRAINTS ALL IMMEDIATE;
  RAISE NOTICE 'PASS A3-2: TOPUP_SETTLE 4-line (two balanced pairs) accepted';
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- 3) An unbalanced CAPTURE shape (VAT line dropped) MUST be rejected.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000000a3';
  b uuid := '00000000-0000-0000-0000-0000000000b3';
  a_reserved bigint; a_revenue bigint; txn bigint;
BEGIN
  SELECT id INTO a_reserved FROM accounts WHERE owner_type='user' AND sub='reserved' AND owner_id=u;
  SELECT id INTO a_revenue  FROM accounts WHERE owner_type='branch' AND sub='revenue' AND owner_id=b;
  BEGIN
    INSERT INTO ledger_transactions(type,idempotency_key) VALUES('CAPTURE','a3-verify:unbalanced') RETURNING id INTO txn;
    INSERT INTO ledger_postings(txn_id,account_id,direction,amount,balance_after) VALUES
      (txn,a_reserved,'DR',22000,0),
      (txn,a_revenue ,'CR',20000,0);     -- missing the 2000 VAT credit
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'FAIL A3-3: unbalanced CAPTURE was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS A3-3: unbalanced CAPTURE rejected (Σ DR ≠ Σ CR)';
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

ROLLBACK;   -- zero residue
