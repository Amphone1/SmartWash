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

# Public client with Direct Access Grants (ROPC) so dev tokens come from curl
$KC create clients -r smartwash \
  -s clientId=smartwash-api \
  -s publicClient=true \
  -s directAccessGrantsEnabled=true \
  -s standardFlowEnabled=true \
  -s 'redirectUris=["*"]' 2>/dev/null || true

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

echo "Keycloak seed done. Get a token, e.g.:"
echo "  curl -s -d 'client_id=smartwash-api&grant_type=password&username=2055501001&password=dev-pass-2055501001' \\"
echo "    http://localhost:8080/realms/smartwash/protocol/openid-connect/token"
