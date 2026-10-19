#!/usr/bin/env bash
# E2E: security-hardening batch —
#   1. login rate limiting (per-account lockout + independent buckets)
#   2. sliding session renewal (DB expiry extends on use)
#   3. permission-cache invalidation (role revoke is immediate)
#   4. sibling session revocation (change-password kills other sessions)
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL_A="smokesec-$(date +%s)@example.test"   # owner
EMAIL_B="smokesecmem-$(date +%s)@example.test" # member (viewer)
EMAIL_C="smokesecbrute-$(date +%s)@example.test" # never verified; lockout target
PW='Smoke-Sec-Password!42'
NEW_PW='Smoke-Sec-Permanent!77'
ORG_NAME="Security Smoke Org $(date +%H%M%S)"

ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; exit 1; }
say() { echo "── $*"; }
expect_true()  { [ "$1" = "true" ]  || bad "$2 (got: $1)"; }
expect_false() { [ "$1" = "false" ] || bad "$2 (got: $1)"; }
jqf() { jq -r "$1" <<<"$2"; }

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

signup_verify() { # email name password jar
  local email=$1 name=$2 pw=$3 jar=$4 R MAIL URL TOKEN
  R=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$pw\",\"acceptTerms\":true}")
  expect_true "$(jqf .success "$R")" "signup $email"
  mark
  curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\"}" > /dev/null
  MAIL=$(wait_mail "verify link for $email")
  URL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$MAIL" | head -1)
  TOKEN=${URL##*token=}
  R=$(curl -s -c "$jar" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOKEN\"}")
  expect_true "$(jqf .success "$R")" "verify-email $email"
}

db() { (cd "$ROOT/packages/database" && set -a && source .env && set +a && "$TSX" src/seed/__smoke-db.ts "$@"); }

echo "workspace: $WORK"
echo "owner=$EMAIL_A member=$EMAIL_B lockout=$EMAIL_C"
echo

say "setup: owner+org, member invited as viewer"
JAR_A=$WORK/a.cookie
JAR_B=$WORK/b.cookie
signup_verify "$EMAIL_A" "Smoke Sec" "$PW" "$JAR_A"
R=$(curl -s -b "$JAR_A" -c "$JAR_A" -X POST $BASE/api/onboarding -H 'Content-Type: application/json' \
  -d "{\"name\":\"$ORG_NAME\",\"kind\":\"LANDLORD\"}")
expect_true "$(jqf .success "$R")" "create org"

ROLES=$(curl -s -b "$JAR_A" -c "$JAR_A" $BASE/api/roles)
VIEWER_ID=$(jqf '.roles[] | select(.slug=="viewer") | .id' "$ROLES")
[ -n "$VIEWER_ID" ] && [ "$VIEWER_ID" != "null" ] || bad "no viewer role id"
R=$(curl -s -b "$JAR_A" -c "$JAR_A" -X POST $BASE/api/members -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_B\",\"name\":\"Smoke Member\",\"roleIds\":[\"$VIEWER_ID\"]}")
expect_true "$(jqf .success "$R")" "invite member: $(jqf .error "$R")"
TEMP=$(jqf .tempPassword "$R")
[ -n "$TEMP" ] && [ "$TEMP" != "null" ] || bad "no temp password in invite response"
MEMBERS=$(curl -s -b "$JAR_A" -c "$JAR_A" $BASE/api/members)
MEMBERSHIP_ID=$(jqf ".members[] | select(.email==\"$EMAIL_B\") | .membershipId" "$MEMBERS")
[ -n "$MEMBERSHIP_ID" ] && [ "$MEMBERSHIP_ID" != "null" ] || bad "no membership id for member"

# member signs in with the one-time temp password and sets a permanent one
R=$(curl -s -c "$JAR_B" -b "$JAR_B" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$TEMP\"}")
expect_true "$(jqf .success "$R")" "member login: $(jqf .error "$R")"
expect_true "$(jqf .mustChangePassword "$R")" "invited member must change password"
R=$(curl -s -b "$JAR_B" -c "$JAR_B" -X POST $BASE/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d "{\"currentPassword\":\"$TEMP\",\"newPassword\":\"$NEW_PW\",\"acceptTerms\":true}")
expect_true "$(jqf .success "$R")" "member sets permanent password: $(jqf .error "$R")"
ok "org ready, member holds viewer role"

say "1. login rate limiting — per-account lockout, buckets independent"
LAST_CODE=""
for i in $(seq 1 11); do
  LAST_CODE=$(curl -s -o "$WORK/rl.json" -w '%{http_code}' -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL_C\",\"password\":\"totally-wrong-$i\"}")
done
[ "$LAST_CODE" = "429" ] || bad "attempt 11 should be 429, got $LAST_CODE"
RA=$(curl -s -D - -o /dev/null -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_C\",\"password\":\"still-wrong\"}" | grep -i '^retry-after:' | tr -d '\r' | awk '{print $2}')
[ -n "$RA" ] || bad "429 missing Retry-After header"
# a DIFFERENT account is unaffected (its own bucket, and IP bucket < 30)
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"wrong-password-here\"}")
[ "$CODE" = "401" ] || bad "other account should be 401, got $CODE"
ok "11th attempt → 429 + Retry-After: ${RA}s; other account still 401"

say "2. sliding session — DB expiry extends on use"
S1=$(db session-expiry "$EMAIL_B")
EXP1=$(jqf '.[0].expiresAt' "$S1")
db set-session-expiry "$EMAIL_B" 20 > /dev/null
S2=$(db session-expiry "$EMAIL_B")
EXP2=$(jqf '.[0].expiresAt' "$S2")
T2=$(date -d "$EXP2" +%s)
NOW=$(date +%s)
[ $((T2 - NOW)) -lt 1600 ] || bad "setup: expiry should be ~20min away (got $EXP2)"
R=$(curl -s -b "$JAR_B" $BASE/api/auth/session)
expect_true "$(jqf .success "$R")" "session use while within threshold"
sleep 1
S3=$(db session-expiry "$EMAIL_B")
EXP3=$(jqf '.[0].expiresAt' "$S3")
T3=$(date -d "$EXP3" +%s)
[ "$T3" -gt "$T2" ] || bad "expiry not extended: $EXP2 → $EXP3"
[ $((T3 - NOW)) -gt 2700 ] || bad "slid expiry should be ~50-60min out (got $EXP3)"
ok "expiry slid $EXP2 → $EXP3 on use"

say "3. permission cache — role revoke is immediate"
PERMS_BEFORE=$(curl -s -b "$JAR_B" $BASE/api/auth/session | jq '.session.permissions | length')
[ "$PERMS_BEFORE" -gt 0 ] || bad "member should have permissions before revoke"
ROLES_BEFORE=$(curl -s -b "$JAR_B" $BASE/api/auth/session | jq -r '.session.roles | join(",")')
case "$ROLES_BEFORE" in *viewer*) ;; *) bad "expected viewer role (got: $ROLES_BEFORE)";; esac
R=$(curl -s -b "$JAR_A" -c "$JAR_A" -X DELETE $BASE/api/members/$MEMBERSHIP_ID/roles \
  -H 'Content-Type: application/json' -d "{\"roleIds\":[\"$VIEWER_ID\"]}")
expect_true "$(jqf .success "$R")" "revoke viewer role: $(jqf .error "$R")"
PERMS_AFTER=$(curl -s -b "$JAR_B" $BASE/api/auth/session | jq '.session.permissions | length')
[ "$PERMS_AFTER" = "0" ] || bad "permissions still cached after revoke: $PERMS_AFTER (before: $PERMS_BEFORE)"
ok "revoked immediately (perms $PERMS_BEFORE → $PERMS_AFTER, no TTL lag)"

say "4. sibling sessions — change-password kills the others"
JAR_D=$WORK/d.cookie
R=$(curl -s -c "$JAR_D" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$NEW_PW\"}")
expect_true "$(jqf .success "$R")" "second login: $(jqf .error "$R")"
grep -q siso_session "$JAR_D" || bad "second session cookie missing"
R=$(curl -s -b "$JAR_B" $BASE/api/auth/session)
expect_true "$(jqf .success "$R")" "primary session alive before change"
R=$(curl -s -b "$JAR_B" -c "$JAR_B" -X POST $BASE/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d "{\"currentPassword\":\"$NEW_PW\",\"newPassword\":\"Smoke-Sec-Final!99\"}")
expect_true "$(jqf .success "$R")" "change-password: $(jqf .error "$R")"
D_ALIVE=$(curl -s -b "$JAR_D" $BASE/api/auth/session | jq -r .success)
[ "$D_ALIVE" = "false" ] || bad "sibling session still alive after password change"
B_ALIVE=$(curl -s -b "$JAR_B" $BASE/api/auth/session | jq -r .success)
expect_true "$B_ALIVE" "current session survives its own password change"
ok "sibling dead, current session kept"

say "5. cleanup"
for e in "$EMAIL_A" "$EMAIL_B" "$EMAIL_C"; do
  (cd "$ROOT/packages/database" && set -a && source .env && set +a && \
    "$TSX" src/seed/__smoke-del-user.ts "$e" >/dev/null)
done
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" -e "
    import { prisma } from './src/index'
    prisma.organization.deleteMany({ where: { name: '$ORG_NAME' } })
      .then(r => console.log('orgs deleted:', r.count))
      .finally(() => prisma.\$disconnect())
  " 2>/dev/null | grep -v Warning)
ok "throwaway accounts + org deleted"

echo
echo "ALL PASS — rate limit · sliding sessions · cache invalidation · session revocation"
