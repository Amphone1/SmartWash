-- ============================================================================
-- 10_inbox_dlq.sql  (EPIC A · increment A6)
-- Consumer inbox for idempotent, exactly-once event consumption (fixes H4: LWW
-- consumer dedup). A consumer inserts (consumer, event_id) before applying a
-- message; the PK + ON CONFLICT DO NOTHING make a redelivery a no-op.
--
-- ADDITIVE: one new operational table. Not append-only (it is a dedup cache,
-- prunable by age like wallets/machine_status). Touches no money/ledger row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS processed_events (
  consumer     TEXT        NOT NULL,            -- durable consumer name
  event_id     TEXT        NOT NULL,            -- stable per-event key (stream sequence)
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);

-- Supports age-based pruning of old dedup rows.
CREATE INDEX IF NOT EXISTS idx_processed_events_at ON processed_events (processed_at);
