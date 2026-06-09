-- ============================================================================
-- SmartWash v5 Enterprise — PostgreSQL Schema
-- Conventions:
--   • UUID primary keys (gen_random_uuid, PG13+)
--   • Money stored as BIGINT in kip (LAK has no minor unit)
--   • timestamptz everywhere; append-only tables never UPDATE/DELETE
--   • ENUMs for state machines; FKs enforce referential integrity
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── ENUM TYPES ─────────────────────────────────────────────────────────────
CREATE TYPE order_type     AS ENUM ('self_service','pickup','delivery');
CREATE TYPE order_state    AS ENUM ('CREATED','RESERVED','PAYMENT_PENDING','AWAITING_APPROVAL',
                                    'PAID','RUNNING','COMPLETED','FAILED','CANCELLED',
                                    'EXPIRED','REJECTED','REFUND_PENDING','REFUNDED');
CREATE TYPE machine_type   AS ENUM ('washer','dryer');
CREATE TYPE machine_state  AS ENUM ('OFFLINE','IDLE','RESERVED','STARTING','RUNNING',
                                    'FINISHING','PAUSED','ERROR','MAINTENANCE');
CREATE TYPE queue_state    AS ENUM ('IN_QUEUE','CALLED','RESERVED','SKIPPED','EXPIRED','LEFT','DONE');
CREATE TYPE pay_req_type   AS ENUM ('topup','order');
CREATE TYPE pay_req_state  AS ENUM ('PENDING','SLIP_UPLOADED','AWAITING_APPROVAL',
                                    'APPROVED','REJECTED','EXPIRED');
CREATE TYPE fraud_state    AS ENUM ('PENDING','PASS','MANUAL_REVIEW','REJECT');
CREATE TYPE ledger_type    AS ENUM ('TOPUP','DEDUCT','REFUND_REVERSAL','ADJUSTMENT');
CREATE TYPE refund_type    AS ENUM ('FULL','PARTIAL');
CREATE TYPE refund_state   AS ENUM ('PENDING','APPROVED','REVERSED','REJECTED');
CREATE TYPE driver_state   AS ENUM ('OFFLINE','AVAILABLE','ASSIGNED','EN_ROUTE_PICKUP','ARRIVED',
                                    'PICKED_UP','AT_BRANCH','READY_FOR_DELIVERY',
                                    'EN_ROUTE_DELIVERY','DELIVERED','REJECTED','TIMEOUT');
CREATE TYPE delivery_state AS ENUM ('CREATED','ASSIGNED','ACCEPTED','EN_ROUTE_PICKUP','PICKED_UP',
                                    'IN_TRANSIT','DELIVERED','COMPLETED','REJECTED','TIMEOUT',
                                    'CANCELLED','FAILED','DISPUTED');
CREATE TYPE recon_status   AS ENUM ('VERIFIED','REVIEW','SUSPICIOUS','ORPHAN');
CREATE TYPE outbox_state   AS ENUM ('PENDING','PUBLISHED','FAILED');
CREATE TYPE saga_state     AS ENUM ('RUNNING','COMPLETED','COMPENSATING','COMPENSATED','FAILED');

-- ============================================================================
-- IDENTITY & RBAC
-- ============================================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    email       TEXT,
    status      TEXT NOT NULL DEFAULT 'active',   -- active|suspended|banned
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id    SMALLINT PRIMARY KEY,
    name  TEXT UNIQUE NOT NULL                    -- customer|driver|owner|admin|staff
);

CREATE TABLE permissions (
    id    SERIAL PRIMARY KEY,
    code  TEXT UNIQUE NOT NULL,                   -- e.g. order.refund, machine.maintenance
    descr TEXT
);

CREATE TABLE role_permissions (
    role_id       SMALLINT REFERENCES roles(id),
    permission_id INT      REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE branches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    name_lao   TEXT,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    open_time  TIME,
    close_time TIME,
    owner_account TEXT,                           -- bank account for Owner QR
    status     TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles is branch-scoped (an owner of branch A, staff of branch B, etc.)
CREATE TABLE user_roles (
    user_id   UUID     REFERENCES users(id) ON DELETE CASCADE,
    role_id   SMALLINT REFERENCES roles(id),
    branch_id UUID     REFERENCES branches(id),  -- NULL = global (admin)
    PRIMARY KEY (user_id, role_id, branch_id)
);

CREATE TABLE drivers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES users(id),
    branch_id   UUID REFERENCES branches(id),
    state       driver_state NOT NULL DEFAULT 'OFFLINE',
    rating      NUMERIC(2,1) DEFAULT 5.0,
    trips       INT DEFAULT 0,
    vehicle     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MACHINES
-- ============================================================================
CREATE TABLE machines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID REFERENCES branches(id),
    code        TEXT NOT NULL,                    -- W001, D002
    type        machine_type NOT NULL,
    capacity_kg INT NOT NULL,
    price       BIGINT NOT NULL,                  -- kip
    fw_version  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, code)
);

-- Current real-time snapshot (1 row per machine, updated by Machine Service)
CREATE TABLE machine_status (
    machine_id     UUID PRIMARY KEY REFERENCES machines(id),
    branch_id      UUID REFERENCES branches(id),
    state          machine_state NOT NULL DEFAULT 'OFFLINE',
    progress       SMALLINT DEFAULT 0,            -- 0-100
    remaining_min  SMALLINT,
    current_order  UUID,                          -- FK added after orders table
    last_seen      TIMESTAMPTZ,                   -- updated by heartbeat/LWT
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_machine_status_branch_state ON machine_status(branch_id, state);

-- Append-only machine event history (telemetry, errors)
CREATE TABLE machine_events (
    id          BIGSERIAL PRIMARY KEY,
    machine_id  UUID REFERENCES machines(id),
    event       TEXT NOT NULL,                    -- STARTING|RUNNING|FINISHED|ERROR|...
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_machine_events_machine_time ON machine_events(machine_id, created_at DESC);

-- ============================================================================
-- ORDERS & QUEUE
-- ============================================================================
CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    branch_id   UUID REFERENCES branches(id),
    machine_id  UUID REFERENCES machines(id),
    type        order_type NOT NULL,
    state       order_state NOT NULL DEFAULT 'CREATED',
    cycle       TEXT,                             -- quick|normal|heavy
    addons      JSONB,
    subtotal    BIGINT NOT NULL DEFAULT 0,
    vat         BIGINT NOT NULL DEFAULT 0,
    total       BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user      ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_branch    ON orders(branch_id, state);
CREATE INDEX idx_orders_machine   ON orders(machine_id);

-- now-resolvable FK from machine_status.current_order
ALTER TABLE machine_status
    ADD CONSTRAINT fk_machine_status_order FOREIGN KEY (current_order) REFERENCES orders(id);

-- Append-only order state transitions (audit of the FSM)
CREATE TABLE order_events (
    id          BIGSERIAL PRIMARY KEY,
    order_id    UUID REFERENCES orders(id),
    from_state  order_state,
    to_state    order_state NOT NULL,
    event       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at);

CREATE TABLE queue_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id  UUID REFERENCES machines(id),
    user_id     UUID REFERENCES users(id),
    position    INT NOT NULL,
    status      queue_state NOT NULL DEFAULT 'IN_QUEUE',
    called_at   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_machine_pos ON queue_entries(machine_id, position) WHERE status = 'IN_QUEUE';

-- ============================================================================
-- PAYMENT ENGINE
-- ============================================================================
CREATE TABLE payment_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    order_id        UUID REFERENCES orders(id),   -- NULL when type = topup
    type            pay_req_type NOT NULL,
    qr_ref          TEXT UNIQUE NOT NULL,
    amount_expected BIGINT NOT NULL,
    state           pay_req_state NOT NULL DEFAULT 'PENDING',
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payreq_user_state ON payment_requests(user_id, state);

CREATE TABLE slips (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_request_id UUID REFERENCES payment_requests(id),
    user_id            UUID REFERENCES users(id),
    slip_hash          TEXT UNIQUE NOT NULL,      -- SHA-256, fraud dedup
    image_object_key   TEXT NOT NULL,             -- Object Storage key
    ocr_amount         BIGINT,
    ocr_ref            TEXT,
    ocr_account        TEXT,
    ocr_confidence     NUMERIC(3,2),
    ocr_json           JSONB,
    fraud_state        fraud_state NOT NULL DEFAULT 'PENDING',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slips_fraud ON slips(fraud_state);

-- Cached wallet balance (source of truth = ledger_entries; this is a fast-read cache)
CREATE TABLE wallets (
    user_id     UUID PRIMARY KEY REFERENCES users(id),
    balance     BIGINT NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'LAK',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- APPEND-ONLY. Never UPDATE/DELETE. balance_after gives running balance.
CREATE TABLE ledger_entries (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    type            ledger_type NOT NULL,
    amount          BIGINT NOT NULL,              -- signed: +topup, -deduct
    balance_after   BIGINT NOT NULL,
    ref_type        TEXT,                         -- order|topup|refund|recon
    ref_id          UUID,
    idempotency_key TEXT UNIQUE,                  -- guards double-posting
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user_time ON ledger_entries(user_id, created_at DESC);

CREATE TABLE risk_scores (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    score       SMALLINT NOT NULL,                -- 0-100
    factors     JSONB,                            -- velocity, dup_attempts, mismatch...
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_user_time ON risk_scores(user_id, computed_at DESC);

CREATE TABLE credit_limits (
    user_id      UUID PRIMARY KEY REFERENCES users(id),
    limit_amount BIGINT NOT NULL DEFAULT 0,       -- postpaid allowance (kip)
    outstanding  BIGINT NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'active',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id),
    user_id     UUID REFERENCES users(id),
    type        refund_type NOT NULL,
    amount      BIGINT NOT NULL,
    reason      TEXT,
    state       refund_state NOT NULL DEFAULT 'PENDING',
    ledger_id   BIGINT REFERENCES ledger_entries(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- FINANCE / SETTLEMENT & RECONCILIATION
-- ============================================================================
CREATE TABLE settlements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id        UUID REFERENCES branches(id),
    period_date      DATE NOT NULL,
    gross            BIGINT NOT NULL DEFAULT 0,
    platform_revenue BIGINT NOT NULL DEFAULT 0,
    staff_payout     BIGINT NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'open',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, period_date)
);

CREATE TABLE settlement_lines (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID REFERENCES settlements(id),
    driver_id     UUID REFERENCES drivers(id),
    trips         INT NOT NULL DEFAULT 0,
    amount        BIGINT NOT NULL DEFAULT 0,
    paid          BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE reconciliation_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID REFERENCES branches(id),
    recon_date  DATE NOT NULL,
    matched     INT DEFAULT 0,
    review      INT DEFAULT 0,
    suspicious  INT DEFAULT 0,
    orphan      INT DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'running',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_statement_lines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recon_run_id     UUID REFERENCES reconciliation_runs(id),
    txn_date         TIMESTAMPTZ,
    amount           BIGINT NOT NULL,
    ref              TEXT,
    sender           TEXT,
    match_status     recon_status NOT NULL DEFAULT 'REVIEW',
    matched_ledger_id BIGINT REFERENCES ledger_entries(id)
);
CREATE INDEX idx_bankline_run_status ON bank_statement_lines(recon_run_id, match_status);

-- ============================================================================
-- DELIVERY ENGINE
-- ============================================================================
CREATE TABLE deliveries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID REFERENCES orders(id),
    driver_id    UUID REFERENCES drivers(id),
    state        delivery_state NOT NULL DEFAULT 'CREATED',
    pickup_addr  TEXT,
    pickup_lat   DOUBLE PRECISION,
    pickup_lng   DOUBLE PRECISION,
    dropoff_addr TEXT,
    dropoff_lat  DOUBLE PRECISION,
    dropoff_lng  DOUBLE PRECISION,
    fee          BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_driver_state ON deliveries(driver_id, state);

-- High-volume GPS pings (consider TimescaleDB hypertable / monthly partitions)
CREATE TABLE driver_locations (
    id          BIGSERIAL PRIMARY KEY,
    driver_id   UUID REFERENCES drivers(id),
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    heading     SMALLINT,
    speed       NUMERIC(5,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_driverloc_driver_time ON driver_locations(driver_id, recorded_at DESC);

-- ============================================================================
-- NOTIFICATION
-- ============================================================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    channel     TEXT NOT NULL,                    -- push|ws|email|sms
    type        TEXT NOT NULL,
    payload     JSONB,
    status      TEXT NOT NULL DEFAULT 'queued',
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_time ON notifications(user_id, created_at DESC);

-- ============================================================================
-- RELIABILITY (Outbox / Saga / Idempotency)
-- ============================================================================
CREATE TABLE outbox (
    id            BIGSERIAL PRIMARY KEY,
    aggregate_type TEXT NOT NULL,                 -- order|machine|payment
    aggregate_id  UUID NOT NULL,
    event_type    TEXT NOT NULL,                  -- OrderPaid|MachineRunning...
    payload       JSONB NOT NULL,
    state         outbox_state NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at  TIMESTAMPTZ
);
CREATE INDEX idx_outbox_pending ON outbox(created_at) WHERE state = 'PENDING';

CREATE TABLE idempotency_keys (
    key          TEXT PRIMARY KEY,
    scope        TEXT NOT NULL,                   -- endpoint / operation
    request_hash TEXT,
    response     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ
);

CREATE TABLE saga_instances (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_type    TEXT NOT NULL,                   -- wash_order|topup
    order_id     UUID REFERENCES orders(id),
    state        saga_state NOT NULL DEFAULT 'RUNNING',
    step         TEXT,
    payload      JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saga_state ON saga_instances(state) WHERE state IN ('RUNNING','COMPENSATING');

-- ============================================================================
-- AUDIT LOG (append-only — who did what)
-- ============================================================================
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID REFERENCES users(id),
    actor_role  TEXT,
    action      TEXT NOT NULL,                    -- slip.approve, refund.issue...
    entity_type TEXT,
    entity_id   UUID,
    before      JSONB,
    after       JSONB,
    ip          INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor_time  ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity      ON audit_log(entity_type, entity_id);

-- ============================================================================
-- SEED: roles & permissions baseline
-- ============================================================================
INSERT INTO roles (id, name) VALUES
    (1,'customer'),(2,'driver'),(3,'staff'),(4,'owner'),(5,'admin')
ON CONFLICT DO NOTHING;
