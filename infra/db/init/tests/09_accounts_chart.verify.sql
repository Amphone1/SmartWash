-- ============================================================================
-- 09_accounts_chart.verify.sql  (A2 DB integration test)
-- Verifies the invariants added by 09_accounts_chart.sql against a real Postgres
-- (PG16). All work runs in ONE transaction that ROLLBACKs at the end, so it
-- leaves ZERO residue. A failed assertion RAISEs and aborts non-zero (CI-friendly).
--
-- Run: psql -v ON_ERROR_STOP=1 -f infra/db/init/tests/09_accounts_chart.verify.sql "$DATABASE_URL"
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Fixture (rolled back): a real user so entity-account inserts are realistic.
INSERT INTO users (id, phone, name)
  VALUES ('00000000-0000-0000-0000-0000000000a2', '+85620VERIFYA2', 'verify-a2');

-- 1) The migration seeded exactly the three platform/tax singletons.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM accounts WHERE owner_id IS NULL
     AND owner_type IN ('platform','tax');
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL 1: expected 3 seeded singletons, found %', n; END IF;
  RAISE NOTICE 'PASS 1: platform/tax singletons seeded';
END $$;

-- 2) Idempotent singleton create: ON CONFLICT dedups the NULL-owner row (F1 fix).
DO $$
DECLARE before_n int; after_n int;
BEGIN
  SELECT count(*) INTO before_n FROM accounts WHERE owner_type='platform' AND sub='bank';
  INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
    VALUES ('ASSET','platform',NULL,'bank','LAK','active')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO NOTHING;
  SELECT count(*) INTO after_n FROM accounts WHERE owner_type='platform' AND sub='bank';
  IF after_n <> before_n THEN
    RAISE EXCEPTION 'FAIL 2: singleton duplicated (% -> %)', before_n, after_n; END IF;
  RAISE NOTICE 'PASS 2: singleton ON CONFLICT dedup (NULLS NOT DISTINCT)';
END $$;

-- 3) Plain duplicate singleton (no ON CONFLICT) violates the unique constraint.
DO $$
BEGIN
  BEGIN
    INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
      VALUES ('LIABILITY','tax',NULL,'vat','LAK','active');
    RAISE EXCEPTION 'FAIL 3: duplicate singleton accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS 3: duplicate singleton rejected (unique_violation)';
  END;
END $$;

-- 4) Entity account with NULL owner_id is rejected (trigger).
DO $$
BEGIN
  BEGIN
    INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
      VALUES ('LIABILITY','user',NULL,'available','LAK','active');
    RAISE EXCEPTION 'FAIL 4: entity account with NULL owner_id accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4: entity NULL owner_id rejected';
  END;
END $$;

-- 5) Singleton with non-NULL owner_id is rejected (trigger).
DO $$
BEGIN
  BEGIN
    INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
      VALUES ('ASSET','platform','00000000-0000-0000-0000-0000000000a2','bank','LAK','active');
    RAISE EXCEPTION 'FAIL 5: singleton with owner_id accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 5: singleton non-null owner_id rejected';
  END;
END $$;

-- 6) Wrong acct_type for a kind is rejected (trigger).
DO $$
BEGIN
  BEGIN
    INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
      VALUES ('ASSET','user','00000000-0000-0000-0000-0000000000a2','available','LAK','active');
    RAISE EXCEPTION 'FAIL 6: wrong acct_type accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 6: wrong acct_type rejected';
  END;
END $$;

-- 7) Uncatalogued kind (vendor) is rejected by the FK (vendor/franchise enum-only).
DO $$
BEGIN
  BEGIN
    INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
      VALUES ('LIABILITY','vendor','00000000-0000-0000-0000-0000000000a2','available','LAK','active');
    RAISE EXCEPTION 'FAIL 7: vendor account accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS 7: vendor (uncatalogued) rejected by FK';
  END;
END $$;

-- 8) Get-or-create upsert is idempotent: same natural key -> same id (resolver SQL).
DO $$
DECLARE id1 bigint; id2 bigint;
BEGIN
  INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
    VALUES ('LIABILITY','user','00000000-0000-0000-0000-0000000000a2','available','LAK','active')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status = accounts.status
    RETURNING id INTO id1;
  INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
    VALUES ('LIABILITY','user','00000000-0000-0000-0000-0000000000a2','available','LAK','active')
    ON CONFLICT ON CONSTRAINT accounts_natural_key DO UPDATE SET status = accounts.status
    RETURNING id INTO id2;
  IF id1 <> id2 THEN RAISE EXCEPTION 'FAIL 8: upsert returned different ids % vs %', id1, id2; END IF;
  RAISE NOTICE 'PASS 8: get-or-create idempotent (id %)', id1;
END $$;

-- 9) Identity is immutable; status may change.
DO $$
DECLARE aid bigint;
BEGIN
  SELECT id INTO aid FROM accounts
    WHERE owner_type='user' AND sub='available'
      AND owner_id='00000000-0000-0000-0000-0000000000a2';
  UPDATE accounts SET status='closed' WHERE id=aid;     -- allowed
  RAISE NOTICE 'PASS 9a: status update allowed';
  BEGIN
    UPDATE accounts SET sub='reserved' WHERE id=aid;     -- blocked
    RAISE EXCEPTION 'FAIL 9b: identity (sub) update allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'PASS 9b: identity update blocked';
  END;
END $$;

ROLLBACK;   -- zero residue
