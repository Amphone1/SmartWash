-- ============================================================================
-- 10_inbox_dlq.verify.sql  (A6 DB integration test)
-- Verifies the inbox dedup semantics of processed_events. One rolled-back txn.
-- Run: psql -v ON_ERROR_STOP=1 -f infra/db/init/tests/10_inbox_dlq.verify.sql "$DATABASE_URL"
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- 1) First insert is accepted (consumer processes the event).
DO $$
DECLARE n int;
BEGIN
  INSERT INTO processed_events (consumer, event_id) VALUES ('wallet-projector', '1001')
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 1: first insert not accepted (rows=%)', n; END IF;
  RAISE NOTICE 'PASS 1: first delivery inserted';
END $$;

-- 2) Redelivery of the same (consumer,event_id) is a no-op (dedup).
DO $$
DECLARE n int;
BEGIN
  INSERT INTO processed_events (consumer, event_id) VALUES ('wallet-projector', '1001')
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 2: duplicate was inserted (rows=%)', n; END IF;
  RAISE NOTICE 'PASS 2: redelivery deduplicated';
END $$;

-- 3) The same event_id for a DIFFERENT consumer is independent.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO processed_events (consumer, event_id) VALUES ('audit-firehose', '1001')
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL 3: per-consumer isolation broken (rows=%)', n; END IF;
  RAISE NOTICE 'PASS 3: per-consumer dedup isolation';
END $$;

-- 4) processed_at defaulted.
DO $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM processed_events WHERE processed_at IS NULL;
  IF c <> 0 THEN RAISE EXCEPTION 'FAIL 4: processed_at null'; END IF;
  RAISE NOTICE 'PASS 4: processed_at defaulted';
END $$;

ROLLBACK;   -- zero residue
