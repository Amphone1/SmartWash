-- ============================================================================
-- SmartWash v5 — migration 08: add `machine.view` permission (REVIEW BY HAND)
-- Additive & idempotent: safe to re-run, and safe to apply to an existing DB.
--
-- Why a forward migration (not an edit to 02_rbac_seed): 02 is an already-applied,
-- checksum-locked migration. New permissions added after first boot follow the
-- pattern established by 05 — insert the code, then grant it explicitly (the
-- admin "grant everything" in 02 only covered permissions that existed at first
-- boot, so new codes must be granted here too).
--
-- `machine.view` = read-only visibility of machines and their real-time state
-- (staff machines screen, owner oversight). Strictly additive capability.
-- ============================================================================

INSERT INTO permissions (code, descr) VALUES
    ('machine.view', 'View machines and their real-time state')
ON CONFLICT (code) DO NOTHING;

-- Grant to staff, owner, and admin (global). Admin is granted explicitly because
-- 02_rbac_seed only blanket-granted admin the permissions present at first boot.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('staff', 'owner', 'admin')
  AND p.code = 'machine.view'
ON CONFLICT DO NOTHING;
