-- ============================================================================
-- Migration 04: order_ratings, user_addresses, notification read tracking
-- ============================================================================

-- Order ratings submitted by customers after delivery
CREATE TABLE order_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    driver_id   UUID REFERENCES drivers(id),
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    tags        TEXT[]   NOT NULL DEFAULT '{}',
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, user_id)
);
CREATE INDEX idx_ratings_order   ON order_ratings(order_id);
CREATE INDEX idx_ratings_driver  ON order_ratings(driver_id);

-- Saved delivery addresses per user (up to 10 per user)
CREATE TABLE user_addresses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    label       TEXT NOT NULL DEFAULT 'Home',
    address     TEXT NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);

-- Notification read receipt (one row per user per notification)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id) WHERE read_at IS NULL;
