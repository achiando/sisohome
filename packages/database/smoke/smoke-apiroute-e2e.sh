#!/usr/bin/env bash
# E2E: exercise every migrated apiRoute endpoint (roles, members, org,
# permissions) plus the 401/400 error paths. Signup→verify→org first.
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL1="smokeapi-$(date +%s)@example.test"
EMAIL2="smokeapimem-$(date +%s)@example.test"
PW='Smoke-ApiRoute-Password!42'
ORG_NAME="APIRoute Smoke Org $(date +%H%M%S)"
ROLE_NAME="Smoke Role $(date +%H%M%S)"
ROLE_SLUG="smoke-role-$(date +%s)"

ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; exit 1; }
say() { echo "── $*"; }
expect_true()  { [ "$1" = "true" ]  || bad "$2 (got: $1)"; }

mkdir -p $OUTBOX_DIRS 2>/dev/null || true
mark() { touch "$WORK/m"; sleep 0.3; }

newest_mail() {
  local d f best="" bestt=0 t
  for d in $OUTBOX_DIRS; do
    [ -d "$d" ] || continue
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      t=$(stat -c %Y "$f")
      if [ "$t" -ge "$bestt" ]; then bestt=$t; best=$f; fi
    done < <(find "$d" -name '*.eml' -newer "$WORK/m" 2>/dev/null)
  done
  printf '%s' "$best"
}

wait_mail() {
  local f="" i
  for i in $(seq 1 60); do
    f=$(newest_mail)
    [ -n "$f" ] && break
    sleep 0.25
  done
  [ -n "$f" ] || bad "no email arrived ($1)"
  echo "$f"
}

jqf() { jq -r "$1" <<<"$2"; }

JAR="$WORK/s.cookie"

say "setup: signup + verify + login + org"
R=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Api\",\"email\":\"$EMAIL1\",\"password\":\"$PW\",\"acceptTerms\":true}")
expect_true "$(jqf .success "$R")" "signup"
mark
curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL1\"}" > /dev/null
MAIL=$(wait_mail "verify link")
URL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$MAIL" | head -1)
TOKEN=${URL##*token=}
R=$(curl -s -c "$JAR" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\"}")
expect_true "$(jqf .success "$R")" "verify-email"
R=$(curl -s -c "$JAR" -b "$JAR" -X POST $BASE/api/onboarding -H 'Content-Type: application/json' \
  -d "{\"name\":\"$ORG_NAME\",\"kind\":\"LANDLORD\"}")
expect_true "$(jqf .success "$R")" "create org"
ok "owner account in fresh org"

api() { curl -s -b "$JAR" -c "$JAR" "$@"; }

say "1. GET /api/roles (role.read) — owner sees kind templates"
R=$(api $BASE/api/roles)
expect_true "$(jqf .success "$R")" "GET roles: $(jqf .error "$R")"
[ "$(jqf '.roles | length' "$R")" -ge 3 ] || bad "expected owner/manager/viewer templates"
ok "$(jqf '.roles | length' "$R") roles listed"

say "2. GET /api/organization (organization.read)"
R=$(api $BASE/api/organization)
expect_true "$(jqf .success "$R")" "GET organization"
[ "$(jqf .organization.name "$R")" = "$ORG_NAME" ] || bad "wrong org name"
ok "active org resolved from session"

say "3. GET /api/members (user.read)"
R=$(api $BASE/api/members)
expect_true "$(jqf .success "$R")" "GET members"
[ "$(jqf '.members | length' "$R")" -ge 1 ] || bad "creator should be a member"
MEMBER_ID=$(jqf '.members[0].membershipId' "$R")
ok "$(jqf '.members | length' "$R") member(s)"

say "4. GET /api/permissions — auth-only, no key required"
R=$(api $BASE/api/permissions)
expect_true "$(jqf .success "$R")" "GET permissions"
[ "$(jqf '.permissions | length' "$R")" -ge 1 ] || bad "catalog empty"
ok "catalog served"

say "5. POST /api/roles (role.manage) — create custom role"
R=$(api -X POST $BASE/api/roles -H 'Content-Type: application/json' \
  -d "{\"name\":\"$ROLE_NAME\",\"slug\":\"$ROLE_SLUG\",\"permissions\":[\"organization.read\",\"user.read\",\"resource.read\",\"resource.list\"]}")
expect_true "$(jqf .success "$R")" "POST roles: $(jqf .error "$R")"
ROLE_ID=$(jqf .role.id "$R")
[ -n "$ROLE_ID" ] && [ "$ROLE_ID" != "null" ] || bad "no role id"
ok "role created ($ROLE_ID)"

say "6. GET/PATCH /api/roles/[id]"
R=$(api $BASE/api/roles/$ROLE_ID)
expect_true "$(jqf .success "$R")" "GET role by id"
[ "$(jqf .role.name "$R")" = "$ROLE_NAME" ] || bad "role name mismatch"
R=$(api -X PATCH $BASE/api/roles/$ROLE_ID -H 'Content-Type: application/json' \
  -d '{"description":"renamed by smoke"}')
expect_true "$(jqf .success "$R")" "PATCH role: $(jqf .error "$R")"
[ "$(jqf .role.description "$R")" = "renamed by smoke" ] || bad "description not updated"
ok "read + update by id"

say "7. validation: POST /api/roles without name → 400 RouteError"
CODE=$(api -o "$WORK/e1.json" -w '%{http_code}' -X POST $BASE/api/roles \
  -H 'Content-Type: application/json' -d '{"slug":"x"}')
[ "$CODE" = "400" ] || bad "expected 400, got $CODE"
expect_true "$(jq -r '.success | not' "$WORK/e1.json")" "success false"
ok "400 with JSON error"

say "8. 404: GET /api/roles/[unknown] → RouteError"
CODE=$(api -o "$WORK/e2.json" -w '%{http_code}' $BASE/api/roles/00000000-0000-4000-8000-000000000000)
[ "$CODE" = "404" ] || bad "expected 404, got $CODE"
ok "404 mapped"

say "9. POST /api/members (user.create + membership.invite)"
R=$(api -X POST $BASE/api/members -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL2\",\"name\":\"Smoke Api Member\",\"roleIds\":[\"$ROLE_ID\"]}")
expect_true "$(jqf .success "$R")" "POST members: $(jqf .error "$R")"
TEMP=$(jqf .tempPassword "$R")
[ -n "$TEMP" ] && [ "$TEMP" != "null" ] || bad "no temp password"
NEW_USER_ID=$(jqf .userId "$R")
ok "member created, temp password issued"

say "10. PATCH /api/members/[id] (membership.manage)"
R=$(api -X PATCH $BASE/api/members/$MEMBER_ID -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Api Renamed"}')
expect_true "$(jqf .success "$R")" "PATCH member: $(jqf .error "$R")"
ok "member updated"

say "11. POST/DELETE /api/members/[id]/roles (role.assign / role.revoke)"
R=$(api $BASE/api/members)
NEW_MEMBER_ID=$(jqf ".members[] | select(.userId==\"$NEW_USER_ID\") | .membershipId" "$R")
[ -n "$NEW_MEMBER_ID" ] || bad "invited membership not listed"
R=$(api -X POST $BASE/api/members/$NEW_MEMBER_ID/roles -H 'Content-Type: application/json' \
  -d "{\"roleIds\":[\"$ROLE_ID\"]}")
expect_true "$(jqf .success "$R")" "assign roles: $(jqf .error "$R")"
R=$(api -X DELETE $BASE/api/members/$NEW_MEMBER_ID/roles -H 'Content-Type: application/json' \
  -d "{\"roleIds\":[\"$ROLE_ID\"]}")
expect_true "$(jqf .success "$R")" "revoke roles: $(jqf .error "$R")"
ok "assign + revoke"

say "12. DELETE /api/roles/[id] (role.manage)"
R=$(api -X DELETE $BASE/api/roles/$ROLE_ID)
expect_true "$(jqf .success "$R")" "DELETE role: $(jqf .error "$R")"
ok "role deleted"

say "13. unauthenticated → 401 JSON"
CODE=$(curl -s -o "$WORK/e3.json" -w '%{http_code}' $BASE/api/roles)
[ "$CODE" = "401" ] || bad "expected 401, got $CODE"
expect_true "$(jq -r '.success | not' "$WORK/e3.json")" "success false"
ok "401 without session"

say "14. cleanup"
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" src/seed/__smoke-del-user.ts "$EMAIL1" >/dev/null && \
  "$TSX" src/seed/__smoke-del-user.ts "$EMAIL2" >/dev/null && \
  "$TSX" -e "
    import { prisma } from './src/index'
    prisma.organization.deleteMany({ where: { name: '$ORG_NAME' } })
      .then(r => console.log('orgs deleted:', r.count))
      .finally(() => prisma.\$disconnect())
  " 2>/dev/null | grep -v Warning)
ok "throwaway accounts + org deleted"

echo
echo "ALL PASS — apiRoute constructor endpoints (permissions, not roles)"
