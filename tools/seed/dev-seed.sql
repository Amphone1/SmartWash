-- ============================================================================
-- DEV SEED (fixtures for the local E2E — NOT a migration; apply manually):
--   docker compose -f infra/docker/docker-compose.dev.yml exec -T postgres \
--     psql -U smartwash -d smartwash < tools/seed/dev-seed.sql
-- Fixed UUIDs so runbook commands are copy-pasteable. Idempotent.
-- Keycloak usernames must equal users.phone (see tools/seed/keycloak-setup.sh).
-- ============================================================================

-- Branch (owner_account matches the saga's OWNER_ACCOUNT + mock-OCR hint)
INSERT INTO branches (id, name, name_lao, lat, lng, owner_account, status)
VALUES ('b0000000-0000-4000-8000-000000000001', 'Vientiane Center', 'ວຽງຈັນ',
        17.9630, 102.6100, 'OWNER-ACC-0001', 'open')
ON CONFLICT (id) DO NOTHING;

-- Machines
INSERT INTO machines (id, branch_id, code, type, capacity_kg, price)
VALUES
  ('aa000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'W001', 'washer', 10, 20000),
  ('aa000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'D001', 'dryer', 10, 15000)
ON CONFLICT (id) DO NOTHING;

-- Users (phone = Keycloak username)
INSERT INTO users (id, phone, name) VALUES
  ('c0000000-0000-4000-8000-000000000001', '2055501001', 'Customer One'),
  ('d0000000-0000-4000-8000-000000000001', '2055502001', 'Driver One'),
  ('e0000000-0000-4000-8000-000000000001', '2055503001', 'Owner One'),
  ('f0000000-0000-4000-8000-000000000001', '2055504001', 'Admin One')
ON CONFLICT (id) DO NOTHING;

-- Role assignments. roles: 1 customer, 2 driver, 3 staff, 4 owner, 5 admin.
-- customer + admin are GLOBAL (branch_id NULL — requires migration 03, see
-- infra/db/init/03_user_roles_nullable_branch.sql); driver/owner branch-scoped.
INSERT INTO user_roles (user_id, role_id, branch_id) VALUES
  ('c0000000-0000-4000-8000-000000000001', 1, NULL),
  ('d0000000-0000-4000-8000-000000000001', 2, NULL),
  ('e0000000-0000-4000-8000-000000000001', 4, 'b0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000001', 5, NULL)
ON CONFLICT DO NOTHING;

-- Driver row (AVAILABLE so delivery assignment can pick them up)
INSERT INTO drivers (id, user_id, branch_id, state, vehicle)
VALUES ('dd000000-0000-4000-8000-000000000001',
        'd0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001', 'AVAILABLE', 'motorbike')
ON CONFLICT (id) DO NOTHING;

-- A starting location for the driver (assignment prefers located drivers)
INSERT INTO driver_locations (driver_id, lat, lng)
VALUES ('dd000000-0000-4000-8000-000000000001', 17.9650, 102.6120);
