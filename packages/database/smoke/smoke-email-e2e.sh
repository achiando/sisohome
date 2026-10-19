#!/usr/bin/env bash
# End-to-end smoke for the email wiring: password-reset link flow + email 2FA.
# Uses the dev outbox (no real credentials): each email is read from .eml.
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL="smokeemail-$(date +%s)@example.test"
OLDPW='Smoke-Email-Password!42'
NEWPW='Smoke-Email-NewPass!77'

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

wait_mail() { # label -> path
  local f="" i
  for i in $(seq 1 60); do
    f=$(newest_mail)
    [ -n "$f" ] && break
    sleep 0.25
  done
  [ -n "$f" ] || bad "no email arrived ($1)"
  echo "$f"
}

reset_url() { grep -a -oE 'http://localhost:3000/reset-password\?token=[A-Za-z0-9_-]+' "$1" | head -1; }
mail_code() { grep -a -E '^[0-9]{6}\r?$' "$1" | head -1 | tr -d '\r'; }

echo "workspace: $WORK"
echo "account:   $EMAIL"
echo

say "1. signup (email-gated) + verify, then log out"
JAR_A=$WORK/a.cookie
mark
R=$(curl -s -c "$JAR_A" -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Email\",\"email\":\"$EMAIL\",\"password\":\"$OLDPW\",\"acceptTerms\":true}")
expect_true "$(echo "$R" | jq -r .success)" "signup: $(echo "$R" | jq -r .error)"
expect_true "$(echo "$R" | jq -r .verificationRequired)" "verificationRequired"
grep -q siso_session "$JAR_A" && bad "session cookie issued before verification"
VMAIL=$(wait_mail "verification link")
VURL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$VMAIL" | head -1 || true)
[ -n "$VURL" ] || bad "no verify link in $VMAIL"
VTOKEN=${VURL##*token=}
V=$(curl -s -c "$JAR_A" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
  -d "{\"token\":\"$VTOKEN\"}")
expect_true "$(echo "$V" | jq -r .success)" "verify-email: $(echo "$V" | jq -r .error)"
grep -q siso_session "$JAR_A" || bad "verify issued no session"
ok "account created, email verified, session issued"

curl -s -c "$JAR_A" -b "$JAR_A" -X POST $BASE/api/auth/logout > /dev/null
ok "logged out"

say "2. request reset link (invariant: same response for unknown email)"
mark
R=$(curl -s -X POST $BASE/api/auth/reset-password -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}")
expect_true "$(echo "$R" | jq -r .success)" "reset-password"
R2=$(curl -s -X POST $BASE/api/auth/reset-password -H 'Content-Type: application/json' \
  -d '{"email":"nobody-ever@example.test"}')
expect_true "$(echo "$R2" | jq -r .success)" "reset-password (unknown email)"
ok "success payload for real and unknown addresses alike"

say "3. read the reset email from the dev outbox"
MAIL1=$(wait_mail "reset")
URL=$(reset_url "$MAIL1")
[ -n "$URL" ] || bad "no reset link in $MAIL1"
TOKEN=${URL##*token=}
ok "reset link extracted (${URL:0:48}…)"

say "4. the reset page renders"
PAGE=$(mktemp)
# mail links carry APP_URL (localhost:3000); follow on $BASE (identical on 3000)
PAGE_URL=${URL/localhost:3000/${BASE#http://}}
CODE=$(curl -s -o "$PAGE" -w '%{http_code}' "$PAGE_URL")
[ "$CODE" = "200" ] || bad "reset page HTTP $CODE"
grep -q "Choose a new password" "$PAGE" || bad "reset page missing heading"
ok "GET $PAGE_URL → 200"

say "5. set the new password with the token"
R=$(curl -s -X POST $BASE/api/auth/new-password -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"$NEWPW\",\"confirmPassword\":\"$NEWPW\"}")
expect_true "$(echo "$R" | jq -r .success)" "new-password: $(echo "$R" | jq -r .error)"
ok "password updated"

say "6. the token is single-use"
R=$(curl -s -X POST $BASE/api/auth/new-password -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"$NEWPW\"}")
expect_false "$(echo "$R" | jq -r .success)" "token reuse"
ok "replaying the link is rejected"

say "7. old password is dead, new one works"
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$OLDPW\"}")
expect_false "$(echo "$R" | jq -r .success)" "old password still accepted"
JAR_B=$WORK/b.cookie
R=$(curl -s -c "$JAR_B" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEWPW\"}")
expect_true "$(echo "$R" | jq -r .success)" "new password login"
grep -q siso_session "$JAR_B" || bad "no session after new-password login"
ok "signed in with the new password"

say "8. turn on EMAIL two-factor (setup + code from outbox)"
mark
R=$(curl -s -c "$JAR_B" -b "$JAR_B" -X POST $BASE/api/auth/2fa/setup \
  -H 'Content-Type: application/json' -d '{"method":"EMAIL"}')
expect_true "$(echo "$R" | jq -r .success)" "2fa setup: $(echo "$R" | jq -r .error)"
MASK=$(echo "$R" | jq -r .email)
[ "$MASK" != "null" ] || bad "setup returned no masked email"
ok "setup accepted, will email $MASK"

MAIL2=$(wait_mail "enrol code")
CODE1=$(mail_code "$MAIL2")
[ -n "$CODE1" ] || bad "no 6-digit code in $MAIL2"
ok "enrolment code extracted"

R=$(curl -s -c "$JAR_B" -b "$JAR_B" -X POST $BASE/api/auth/2fa/enable \
  -H 'Content-Type: application/json' -d "{\"token\":\"$CODE1\",\"method\":\"EMAIL\"}")
expect_true "$(echo "$R" | jq -r .success)" "2fa enable: $(echo "$R" | jq -r .error)"
COUNT=$(echo "$R" | jq '.recoveryCodes | length')
[ "$COUNT" = "10" ] || bad "expected 10 recovery codes, got $COUNT"
ok "email 2FA enabled, 10 recovery codes issued"

curl -s -c "$JAR_B" -b "$JAR_B" -X POST $BASE/api/auth/logout > /dev/null

say "9. fresh login pauses on the EMAIL channel"
mark
JAR_C=$WORK/c.cookie
R=$(curl -s -c "$JAR_C" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEWPW\"}")
expect_true "$(echo "$R" | jq -r .twoFactorRequired)" "twoFactorRequired"
expect_true "$(echo "$R" | jq -r .success)" "login success flag"
[ "$(echo "$R" | jq -r .twoFactorChannel)" = "email" ] || bad "channel is not email: $(echo "$R" | jq -r .twoFactorChannel)"
grep -q siso_2fa_pending "$JAR_C" || bad "pending cookie missing"
grep -q siso_session "$JAR_C" && bad "session issued before 2FA"
ok "paused: pending cookie set, no session, channel=email"

say "10. wrong code is refused"
R=$(curl -s -c "$JAR_C" -b "$JAR_C" -X POST $BASE/api/auth/2fa/verify \
  -H 'Content-Type: application/json' -d '{"token":"000000"}')
expect_false "$(echo "$R" | jq -r .success)" "bad code accepted"
grep -q siso_session "$JAR_C" && bad "session issued on bad code"
ok "bad code refused"

say "11. the emailed sign-in code completes sign-in"
MAIL3=$(wait_mail "sign-in code")
CODE2=$(mail_code "$MAIL3")
[ -n "$CODE2" ] || bad "no 6-digit code in $MAIL3"
ok "sign-in code extracted"
R=$(curl -s -c "$JAR_C" -b "$JAR_C" -X POST $BASE/api/auth/2fa/verify \
  -H 'Content-Type: application/json' -d "{\"token\":\"$CODE2\"}")
expect_true "$(echo "$R" | jq -r .success)" "verify: $(echo "$R" | jq -r .error)"
grep -q siso_session "$JAR_C" || bad "no session after verify"
ok "session issued — signed in via email code"

say "12. cleanup"
curl -s -c "$JAR_C" -b "$JAR_C" -X POST $BASE/api/auth/logout > /dev/null
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" src/seed/__smoke-del-user.ts "$EMAIL" >/dev/null)
ok "throwaway account deleted"

echo
echo "ALL PASS — password reset (link) + email 2FA, read from the dev outbox"
