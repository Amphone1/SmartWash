-- ============================================================================
-- SmartWash v5 — migration 03 (REVIEW-APPROVED)
-- Fix user_roles: the composite PRIMARY KEY forced branch_id NOT NULL, making
-- global role grants (branch_id NULL = "global", e.g. admin, customer) — which
-- the RBAC + Auth services already implement — impossible to store.
-- Replace the PK with a UNIQUE constraint that treats NULLs as equal, so
-- duplicate grants (including duplicate global grants) remain impossible. PG15+.
-- Note: dropping a PK does NOT clear the NOT NULL column marker it implied,
-- so branch_id needs an explicit DROP NOT NULL. Idempotent.
-- ============================================================================
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE user_roles ALTER COLUMN branch_id DROP NOT NULL;
DO $$
BEGIN
  ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_unique
    UNIQUE NULLS NOT DISTINCT (user_id, role_id, branch_id);
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
