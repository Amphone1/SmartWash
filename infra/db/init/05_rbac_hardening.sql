-- ============================================================================
-- SmartWash v5 — migration 05: RBAC permission hygiene (REVIEW BY HAND)
-- Additive & idempotent: safe to re-run, and safe to apply to an existing DB.
--
-- Closes two audit findings (2026-06-14):
--   #5  A write action (reconciliation run) was gated by a READ permission
--       (report.view). Introduce a dedicated `recon.run` write permission.
--   #6  The admin-global dashboards (all-branch summary / reconciliation / audit)
--       were gated by `report.view`, which owners also hold — they stayed
--       admin-only only by the accident that those routes carry no branch
--       context. Make it explicit with `report.view.global`, granted to admin
--       only, so a (future) global-scoped owner can never reach them.
--
-- SECURITY NOTE: granting a code here grants real capability. Both new codes are
-- granted ONLY to admin. Owners/staff are unaffected (their `report.view`,
-- branch-scoped, still gates the owner/* dashboards).
-- ============================================================================

INSERT INTO permissions (code, descr) VALUES
    ('recon.run',          'Trigger a reconciliation run'),
    ('report.view.global', 'View global, all-branch reports and dashboards')
ON CONFLICT (code) DO NOTHING;

-- Grant both to admin (global). 02_rbac_seed granted admin every permission that
-- existed at first boot; these are new, so grant them explicitly here.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code IN ('recon.run', 'report.view.global')
ON CONFLICT DO NOTHING;
