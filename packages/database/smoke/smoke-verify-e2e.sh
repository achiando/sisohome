#!/usr/bin/env bash
# E2E: signup → email verification gate → login alert; then member-add →
# temp-password email → first sign-in. Emails read from the dev outbox.
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL1="smokeverify-$(date +%s)@example.test"
EMAIL2="smokemember-$(date +%s)@example.test"
PW='Smoke-Verify-Password!42'
ORG_NAME="Verify Smoke Org $(date +%H%M%S)"

ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; exit 1; }
say() { echo "── $*"; }
expect_true()  { [ "$1" = "true" ]  || bad "$2 (got: $1)"; }
expect_false() { [ "$1" = "false" ] || bad "$2 (got: $1)"; }

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

echo "workspace: $WORK"
echo "accounts:  $EMAIL1 (signup) · $EMAIL2 (invited)"
echo

say "1. signup creates the account but withholds the session"
mark
HDR=$WORK/hdr.txt
R=$(curl -s -D "$HDR" -c "$WORK/s.cookie" -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Verify\",\"email\":\"$EMAIL1\",\"password\":\"$PW\",\"acceptTerms\":true}")
expect_true "$(echo "$R" | jq -r .success)" "signup: $(echo "$R" | jq -r .error)"
expect_true "$(echo "$R" | jq -r .verificationRequired)" "verificationRequired flag"
[ "$(echo "$R" | jq -r .email)" = "$EMAIL1" ] || bad "email not echoed"
grep -qi 'set-cookie: siso_session' "$HDR" && bad "session cookie issued before verification"
ok "account created, no session cookie"

say "2. login is refused until the address is verified"
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL1\",\"password\":\"$PW\"}")
expect_false "$(echo "$R" | jq -r .success)" "login while unverified"
expect_true "$(echo "$R" | jq -r .needsVerification)" "needsVerification flag"
[ "$(echo "$R" | jq -r .email)" = "$EMAIL1" ] || bad "login did not echo email"
ok "401 with needsVerification + email"

say "3. resend issues a fresh link"
mark
R=$(curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL1\"}")
expect_true "$(echo "$R" | jq -r .success)" "resend"
R=$(curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
  -d '{"email":"definitely-not-registered@example.test"}')
expect_true "$(echo "$R" | jq -r .success)" "resend (unknown email — same answer)"

MAIL1=$(wait_mail "verification link")
URL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$MAIL1" | head -1 || true)
[ -n "$URL" ] || bad "no verify link in $MAIL1"
TOKEN=${URL##*token=}
grep -aq "Confirm your email address" "$MAIL1" || bad "unexpected template"
ok "verification link extracted"

say "4. the verification page renders"
# links in mail always carry APP_URL (localhost:3000); follow them on $BASE
# so the smoke works when the app runs on an alternate port (identical on 3000)
PAGE_URL=${URL/localhost:3000/${BASE#http://}}
CODE=$(curl -s -o "$WORK/page.html" -w '%{http_code}' "$PAGE_URL")
[ "$CODE" = "200" ] || bad "verify page HTTP $CODE"
grep -q "Verify your email\|Check your email\|Verifying" "$WORK/page.html" || bad "verify page missing heading"
ok "GET verify link → 200"

say "5. redeeming the link verifies the account and signs in"
HDR=$WORK/hdr2.txt
R=$(curl -s -D "$HDR" -c "$WORK/v.cookie" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\"}")
expect_true "$(echo "$R" | jq -r .success)" "verify-email: $(echo "$R" | jq -r .error)"
grep -qi 'set-cookie: siso_session' "$HDR" || bad "no session cookie after verify"
grep -q siso_session "$WORK/v.cookie" || bad "cookie jar missing session"
ok "emailVerifiedAt set, session issued"

say "6. replaying the link says already verified"
R=$(curl -s -o "$WORK/replay.json" -w '%{http_code}' -X POST $BASE/api/auth/verify-email \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}")
[ "$R" = "409" ] || bad "replay HTTP $R"
expect_true "$(jq -r .alreadyVerified "$WORK/replay.json")" "alreadyVerified flag"
ok "409 + alreadyVerified"

say "7. login now works — and emails a sign-in notice"
mark
R=$(curl -s -c "$WORK/a.cookie" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL1\",\"password\":\"$PW\"}")
expect_true "$(echo "$R" | jq -r .success)" "login after verify"
grep -q siso_session "$WORK/a.cookie" || bad "no session"
ok "signed in"

MAIL2=$(wait_mail "login alert")
grep -aq "New sign-in to your account" "$MAIL2" || bad "login alert template missing"
grep -aq "Device:" "$MAIL2" || bad "login alert missing device row"
grep -aq "Location:" "$MAIL2" || bad "login alert missing location row"
grep -aq "IP address:" "$MAIL2" || bad "login alert missing IP row"
grep -aq "Time:" "$MAIL2" || bad "login alert missing time row"
grep -aq "Unknown browser (Desktop)" "$MAIL2" || bad "device row should classify the UA"
grep -aq "Local machine" "$MAIL2" || bad "loopback should read Local machine"
ok "login alert email with device + location + IP + time"

say "8. create an org, then invite a member (temp-password email)"
R=$(curl -s -c "$WORK/a.cookie" -b "$WORK/a.cookie" -X POST $BASE/api/onboarding -H 'Content-Type: application/json' \
  -d "{\"name\":\"$ORG_NAME\",\"kind\":\"LANDLORD\"}")
expect_true "$(echo "$R" | jq -r .success)" "create org: $(echo "$R" | jq -r .error)"
ROLE_ID=$(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  ./node_modules/.bin/tsx src/seed/__smoke-role-id.ts "$ORG_NAME")
[ -n "$ROLE_ID" ] || bad "no role id for the new org"
mark
R=$(curl -s -c "$WORK/a.cookie" -b "$WORK/a.cookie" -X POST $BASE/api/members -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL2\",\"name\":\"Smoke Member\",\"roleIds\":[\"$ROLE_ID\"]}")
expect_true "$(echo "$R" | jq -r .success)" "create member: $(echo "$R" | jq -r .error)"
TEMP=$(echo "$R" | jq -r .tempPassword)
[ -n "$TEMP" ] && [ "$TEMP" != "null" ] || bad "no temp password returned"
ok "member created, temp password issued"

MAIL3=$(wait_mail "member added")
grep -aq "You've been added to $ORG_NAME" "$MAIL3" || bad "member email heading missing"
grep -aq "temporary password" "$MAIL3" || bad "member email copy missing"
grep -aqF "$TEMP" "$MAIL3" || bad "temp password not in the email"
ok "invitation email contains the temporary password"

say "9. the invited member signs in with the temporary password"
R=$(curl -s -c "$WORK/m.cookie" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"$TEMP\"}")
expect_true "$(echo "$R" | jq -r .success)" "temp password login: $(echo "$R" | jq -r .error)"
expect_true "$(echo "$R" | jq -r .mustChangePassword)" "mustChangePassword flag"
[ "$(echo "$R" | jq -r .session.organizationId)" != "null" ] || bad "no active org on member login"
ok "signed in, must change password, org active"

say "10. cleanup"
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
echo "ALL PASS — signup verification, login alert, member temp-password email"
