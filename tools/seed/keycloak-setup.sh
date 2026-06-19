#!/usr/bin/env bash
# DEV Keycloak seed — realm, ROPC client, users (usernames = users.phone from
# tools/seed/dev-seed.sql). Run inside the keycloak container:
#   docker compose -f infra/docker/docker-compose.dev.yml exec -T keycloak \
#     bash < tools/seed/keycloak-setup.sh
# Idempotent-ish: create calls that already exist just error and are ignored.
set -u
KC=/opt/keycloak/bin/kcadm.sh

$KC config credentials --server http://localhost:8080 --realm master \
  --user admin --password change_me

# Realm
$KC create realms -s realm=smartwash -s enabled=true 2>/dev/null || true

# Public clients with Direct Access Grants (ROPC): smartwash-api for curl/dev
# tooling + one per UI (each app/portal logs in with its own client_id).
# webOrigins="+" (CORS = the redirect origins) is DEV ONLY — pin real origins
# in prod.
# smartwash-app = the Flutter super app (Customer · Driver · Staff in one login).
for c in smartwash-api smartwash-app smartwash-customer-app smartwash-driver-app \
         smartwash-owner-portal smartwash-admin-portal; do
  $KC create clients -r smartwash \
    -s "clientId=$c" \
    -s publicClient=true \
    -s directAccessGrantsEnabled=true \
    -s standardFlowEnabled=true \
    -s 'redirectUris=["*"]' \
    -s 'webOrigins=["*"]' 2>/dev/null || true
done

# KC 25 drops attributes not in the user-profile schema unless unmanaged
# attributes are enabled (needed for branch_id below).
$KC update realms/smartwash/users/profile -s 'unmanagedAttributePolicy=ENABLED'

# Realm roles — the UIs gate login on realm_access.roles.
for r in customer driver owner admin staff; do
  $KC create roles -r smartwash -s "name=$r" 2>/dev/null || true
done

# Users — username MUST equal users.phone in the DB seed. Clear requiredActions
# + mark email verified, or ROPC fails with "Account is not fully set up".
for u in 2055501001:Customer:One 2055502001:Driver:One 2055503001:Owner:One 2055504001:Admin:One; do
  phone="${u%%:*}"; rest="${u#*:}"; first="${rest%%:*}"; last="${rest#*:}"
  $KC create users -r smartwash \
    -s "username=$phone" -s enabled=true \
    -s "firstName=$first" -s "lastName=$last" 2>/dev/null || true
  uid=$($KC get users -r smartwash -q "username=$phone" --fields id --format csv --noquotes | head -1)
  # email is a REQUIRED profile attribute in KC 24+ — without it the dynamic
  # Verify Profile action rejects direct grants ("Account is not fully set up").
  $KC update "users/$uid" -r smartwash -s 'requiredActions=[]' \
    -s emailVerified=true -s "email=user$phone@dev.local"
  $KC set-password -r smartwash --username "$phone" --new-password "dev-pass-$phone"
done

# Role assignments matching the DB user_roles seed.
$KC add-roles -r smartwash --uusername 2055501001 --rolename customer 2>/dev/null || true
$KC add-roles -r smartwash --uusername 2055502001 --rolename driver 2>/dev/null || true
$KC add-roles -r smartwash --uusername 2055503001 --rolename owner 2>/dev/null || true
$KC add-roles -r smartwash --uusername 2055504001 --rolename admin 2>/dev/null || true

# Owner portal reads branch_id from the JWT — attach the seeded branch to the
# owner user and map the attribute into smartwash-owner-portal tokens.
OWNER_UID=$($KC get users -r smartwash -q username=2055503001 --fields id --format csv --noquotes | head -1)
$KC update "users/$OWNER_UID" -r smartwash \
  -s 'attributes={"branch_id":["b0000000-0000-4000-8000-000000000001"]}'
OWNER_CID=$($KC get clients -r smartwash -q clientId=smartwash-owner-portal --fields id --format csv --noquotes)
$KC create "clients/$OWNER_CID/protocol-mappers/models" -r smartwash \
  -s name=branch-id \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-usermodel-attribute-mapper \
  -s 'config={"user.attribute":"branch_id","claim.name":"branch_id","jsonType.label":"String","access.token.claim":"true","id.token.claim":"true"}' \
  2>/dev/null || true

echo "Keycloak seed done. Get a token, e.g.:"
echo "  curl -s -d 'client_id=smartwash-api&grant_type=password&username=2055501001&password=dev-pass-2055501001' \\"
echo "    http://localhost:8080/realms/smartwash/protocol/openid-connect/token"
