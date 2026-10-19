#!/usr/bin/env bash
# E2E: versioned consent —
#   1. /terms and /privacy are public (no session)
#   2. signup refuses without acceptTerms and creates no partial user
#   3. signup with acceptTerms records both consents (version + IP)
#   4. invited member: login surfaces needsConsent; change-password
#      refuses without acceptTerms and succeeds with it
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL_A="smokeconsent-$(date +%s)@example.test"  # direct signup
EMAIL_B="smokeconsentmem-$(date +%s)@example.test" # invited member
PW='Smoke-Consent-Password!42'
ORG_NAME="Consent Smoke Org $(date +%H%M%S)"

ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; exit 1; }
say() { echo "── $*"; }
expect_true()  { [ "$1" = "true" ]  || bad "$2 (got: $1)"; }
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

db() { (cd "$ROOT/packages/database" && set -a && source .env && set +a && "$TSX" src/seed/__smoke-db.ts "$@"); }

echo "workspace: $WORK"
echo "signup=$EMAIL_A invited=$EMAIL_B"
echo

say "1. legal pages are public"
CODE=$(curl -s -o "$WORK/terms.html" -w '%{http_code}' $BASE/terms)
[ "$CODE" = "200" ] || bad "/terms HTTP $CODE"
grep -q "Terms of Service" "$WORK/terms.html" || bad "/terms missing heading"
CODE=$(curl -s -o "$WORK/privacy.html" -w '%{http_code}' $BASE/privacy)
[ "$CODE" = "200" ] || bad "/privacy HTTP $CODE"
grep -q "Privacy Policy" "$WORK/privacy.html" || bad "/privacy missing heading"
grep -q "v1-2026-10-19" "$WORK/terms.html" || bad "/terms missing version stamp"
ok "/terms and /privacy render without a session, version-stamped"

say "2. signup refuses without consent — and leaves no partial user"
R=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Consent\",\"email\":\"$EMAIL_A\",\"password\":\"$PW\"}")
expect_true "$(jqf '.success | not' "$R")" "signup without acceptTerms should fail"
echo "$R" | grep -qi "terms of service" || bad "error should mention the terms"
CONS=$(db consents "$EMAIL_A")
[ "$CONS" = "[]" ] || bad "consent rows exist without acceptance: $CONS"
ok "400 with terms message, zero consent rows"

say "3. signup with consent records both documents, versioned + IP'd"
JAR_A=$WORK/a.cookie
R=$(curl -s -c "$JAR_A" -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Consent\",\"email\":\"$EMAIL_A\",\"password\":\"$PW\",\"acceptTerms\":true}")
expect_true "$(jqf .success "$R")" "signup with acceptTerms: $(jqf .error "$R")"
expect_true "$(jqf .verificationRequired "$R")" "verificationRequired"
CONS=$(db consents "$EMAIL_A")
COUNT=$(jq 'length' <<<"$CONS")
[ "$COUNT" = "2" ] || bad "expected 2 consent rows, got $COUNT: $CONS"
TYPES=$(jq -r '.[].type' <<<"$CONS" | sort | tr '\n' ',')
[ "$TYPES" = "PRIVACY_POLICY,TERMS_OF_SERVICE," ] || bad "wrong consent types: $TYPES"
echo "$CONS" | jq -e 'all(.[]; .policyVersion == "v1-2026-10-19")' > /dev/null || bad "wrong policy version: $CONS"
echo "$CONS" | jq -e 'all(.[]; .ipAddress != null)' > /dev/null || bad "missing ipAddress: $CONS"
ok "TERMS + PRIVACY at v1-2026-10-19, IP recorded"

say "4. finish signup, create org, invite a member"
mark
curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_A\"}" > /dev/null
MAIL=$(wait_mail "verify link")
URL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$MAIL" | head -1)
TOKEN=${URL##*token=}
R=$(curl -s -c "$JAR_A" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\"}")
expect_true "$(jqf .success "$R")" "verify-email"
R=$(curl -s -b "$JAR_A" -c "$JAR_A" -X POST $BASE/api/onboarding -H 'Content-Type: application/json' \
  -d "{\"name\":\"$ORG_NAME\",\"kind\":\"LANDLORD\"}")
expect_true "$(jqf .success "$R")" "create org"
ROLES=$(curl -s -b "$JAR_A" -c "$JAR_A" $BASE/api/roles)
VIEWER_ID=$(jqf '.roles[] | select(.slug=="viewer") | .id' "$ROLES")
R=$(curl -s -b "$JAR_A" -c "$JAR_A" -X POST $BASE/api/members -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_B\",\"name\":\"Smoke Consent Member\",\"roleIds\":[\"$VIEWER_ID\"]}")
expect_true "$(jqf .success "$R")" "invite member"
TEMP=$(jqf .tempPassword "$R")
[ -n "$TEMP" ] && [ "$TEMP" != "null" ] || bad "no temp password"
ok "org ready, member invited (no consent yet)"

say "5. invited member login surfaces needsConsent"
JAR_B=$WORK/b.cookie
R=$(curl -s -c "$JAR_B" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$TEMP\"}")
expect_true "$(jqf .success "$R")" "member login: $(jqf .error "$R")"
expect_true "$(jqf .mustChangePassword "$R")" "mustChangePassword"
expect_true "$(jqf .needsConsent "$R")" "login should flag needsConsent"
CONS=$(db consents "$EMAIL_B")
[ "$CONS" = "[]" ] || bad "invited member should have no consents yet"
ok "login: needsConsent=true, mustChangePassword=true, zero rows"

say "6. change-password refuses without the opt-in, succeeds with it"
R=$(curl -s -b "$JAR_B" -c "$JAR_B" -X POST $BASE/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d "{\"currentPassword\":\"$TEMP\",\"newPassword\":\"$PW\"}")
CODE=$(jqf '.success | not' "$R")
expect_true "$CODE" "change-password without acceptTerms should fail"
expect_true "$(jqf .needsConsent "$R")" "400 should carry needsConsent flag"
# password must be UNCHANGED by the refused attempt — the temp still works
R=$(curl -s -b "$JAR_B" -c "$JAR_B" -X POST $BASE/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d "{\"currentPassword\":\"$TEMP\",\"newPassword\":\"$PW\",\"acceptTerms\":true}")
expect_true "$(jqf .success "$R")" "change-password with acceptTerms: $(jqf .error "$R")"
CONS=$(db consents "$EMAIL_B")
COUNT=$(jq 'length' <<<"$CONS")
[ "$COUNT" = "2" ] || bad "expected 2 consents after opt-in, got $COUNT"
ok "400 without opt-in (password untouched), success + 2 rows with it"

say "7. session reports the consent gap closed"
R=$(curl -s -b "$JAR_B" $BASE/api/auth/session)
expect_true "$(jqf .success "$R")" "session"
[ "$(jqf .needsConsent "$R")" = "false" ] || bad "needsConsent still true after acceptance"
ok "needsConsent=false on the refreshed session"

say "8. cleanup"
for e in "$EMAIL_A" "$EMAIL_B"; do
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
echo "ALL PASS — versioned consent: signup gate · invited-member gate · public legal pages"
