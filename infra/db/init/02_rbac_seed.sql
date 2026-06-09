-- ============================================================================
-- SmartWash v5 — RBAC baseline seed (Phase 1)
-- Additive & idempotent: safe to re-run. Defines the permission catalogue and
-- maps it onto the roles seeded in 01_schema.sql (customer/driver/staff/owner/admin).
--
-- SECURITY NOTE: this is the authoritative permission grant for Phase 1. Review
-- carefully — adding a code here grants real capability. Branch scoping is NOT
-- encoded here; it comes from user_roles.branch_id at decision time (a staff
-- row scoped to branch A only grants staff perms within branch A).
-- ============================================================================

-- ─── Permission catalogue ───────────────────────────────────────────────────
INSERT INTO permissions (code, descr) VALUES
    -- customer
    ('order.create',      'Create a wash/delivery order'),
    ('order.view.own',    'View own orders'),
    ('queue.join',        'Join a machine queue'),
    ('payment.create',    'Create a payment request / upload slip'),
    ('wallet.view.own',   'View own wallet balance and entries'),
    ('delivery.request',  'Request a pickup/delivery'),
    -- driver
    ('delivery.view',     'View assigned deliveries'),
    ('delivery.accept',   'Accept a delivery assignment'),
    ('delivery.update',   'Update delivery state'),
    ('location.report',   'Report GPS location'),
    -- staff
    ('order.view.branch', 'View orders within own branch'),
    ('slip.approve',      'Approve a payment slip'),
    ('slip.reject',       'Reject a payment slip'),
    ('machine.maintenance','Put a machine into maintenance'),
    ('queue.manage',      'Manage a machine queue'),
    -- owner
    ('branch.view',       'View branch details and KPIs'),
    ('report.view',       'View reports and dashboards'),
    ('settlement.view',   'View settlements'),
    ('staff.payout',      'Approve staff payouts'),
    ('machine.manage',    'Add/configure machines'),
    -- admin-only
    ('order.refund',      'Issue a refund'),
    ('user.manage',       'Manage users and roles'),
    ('branch.manage',     'Create/configure branches')
ON CONFLICT (code) DO NOTHING;

-- ─── Role → permission grants ───────────────────────────────────────────────
-- Helper pattern: map by role name + permission code so ids stay decoupled.

-- customer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'customer'
  AND p.code IN ('order.create','order.view.own','queue.join',
                 'payment.create','wallet.view.own','delivery.request')
ON CONFLICT DO NOTHING;

-- driver
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'driver'
  AND p.code IN ('delivery.view','delivery.accept','delivery.update','location.report')
ON CONFLICT DO NOTHING;

-- staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'staff'
  AND p.code IN ('order.view.branch','slip.approve','slip.reject',
                 'machine.maintenance','queue.manage')
ON CONFLICT DO NOTHING;

-- owner (branch oversight)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'owner'
  AND p.code IN ('branch.view','report.view','settlement.view',
                 'staff.payout','machine.manage','order.view.branch')
ON CONFLICT DO NOTHING;

-- admin: every permission (global). New permissions auto-granted on re-run.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
