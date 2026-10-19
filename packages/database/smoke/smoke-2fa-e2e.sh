#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
TOKEN=$ROOT/apps/web/scripts/__smoke-token.ts
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
EMAIL="smoke2fa-$(date +%s)@example.test"
PW='Smoke-2fa-Password!42'

ok()   { echo "  ✓ $*"; }
bad()  { echo "  ✗ $*"; exit 1; }
expect_true() { [ "$1" = "true" ] || bad "$2 (got: $1)"; }

say() { echo "── $*"; }

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

say "1. signup (email-gated) then verify to get a session"
JAR1=$WORK/s1.cookie
mark
R=$(curl -s -c "$JAR1" -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke TwoFA\",\"email\":\"$EMAIL\",\"password\":\"$PW\",\"acceptTerms\":true}")
expect_true "$(echo "$R" | jq -r .success)" "signup"
expect_true "$(echo "$R" | jq -r .verificationRequired)" "verificationRequired"
grep -q siso_session "$JAR1" && bad "session cookie issued before verification"
ok "account created, no session yet"

MAIL=$(wait_mail "verification link")
URL=$(grep -a -oE 'http://localhost:3000/verify-email\?token=[A-Za-z0-9_-]+' "$MAIL" | head -1 || true)
[ -n "$URL" ] || bad "no verify link in $MAIL"
VTOKEN=${URL##*token=}
V=$(curl -s -c "$JAR1" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
  -d "{\"token\":\"$VTOKEN\"}")
expect_true "$(echo "$V" | jq -r .success)" "verify-email: $(echo "$V" | jq -r .error)"
grep -q siso_session "$JAR1" || bad "verify issued no session"
ok "email verified, session issued"

say "2. 2fa setup"
S=$(curl -s -c "$JAR1" -b "$JAR1" -X POST $BASE/api/auth/2fa/setup)
expect_true "$(echo "$S" | jq -r .success)" "setup: $(echo "$S" | jq -r .error)"
SECRET=$(echo "$S" | jq -r .secret)
QR=$(echo "$S" | jq -r .qrDataUri)
[ -n "$SECRET" ] && [ "$SECRET" != "null" ] || bad "no secret"
case "$QR" in "data:image/png;base64,"*) ;; *) bad "qr is not a data uri" ;; esac
ok "secret issued, QR rendered"

say "3. enable (proves the scan)"
TOK=$($TSX "$TOKEN" "$SECRET")
E=$(curl -s -c "$JAR1" -b "$JAR1" -X POST $BASE/api/auth/2fa/enable \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}")
expect_true "$(echo "$E" | jq -r .success)" "enable: $(echo "$E" | jq -r .error)"
COUNT=$(echo "$E" | jq '.recoveryCodes | length')
[ "$COUNT" = "10" ] || bad "expected 10 recovery codes, got $COUNT"
RC0=$(echo "$E" | jq -r '.recoveryCodes[0]')
ok "enabled, 10 recovery codes issued once"

say "4. fresh login → password accepted, no session yet"
curl -s -c "$JAR1" -b "$JAR1" -X POST $BASE/api/auth/logout > /dev/null
JAR2=$WORK/s2.cookie
L=$(curl -s -c "$JAR2" -b "$JAR2" -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
expect_true "$(echo "$L" | jq -r .twoFactorRequired)" "twoFactorRequired"
[ "$(echo "$L" | jq -r .success)" = "true" ] || bad "login success flag"
grep -q siso_2fa_pending "$JAR2" || bad "pending cookie missing"
grep -q siso_session "$JAR2" && bad "session cookie issued before 2FA"
ok "pending cookie set, no session yet"

say "5. verify with authenticator code"
TOK=$($TSX "$TOKEN" "$SECRET")
V=$(curl -s -c "$JAR2" -b "$JAR2" -X POST $BASE/api/auth/2fa/verify \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}")
expect_true "$(echo "$V" | jq -r .success)" "verify: $(echo "$V" | jq -r .error)"
grep -q siso_session "$JAR2" || bad "verify issued no session"
ok "session issued"

say "6. wrong code is rejected"
curl -s -c "$JAR2" -b "$JAR2" -X POST $BASE/api/auth/logout > /dev/null
JAR3=$WORK/s3.cookie
L=$(curl -s -c "$JAR3" -b "$JAR3" -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
expect_true "$(echo "$L" | jq -r .twoFactorRequired)" "twoFactorRequired (2)"
# a code from a different secret guarantees a mismatch
FOREIGN=$($TSX "$TOKEN")
VB=$(curl -s -o "$WORK/bad.json" -w '%{http_code}' -c "$JAR3" -b "$JAR3" -X POST \
  $BASE/api/auth/2fa/verify -H 'Content-Type: application/json' -d "{\"token\":\"$FOREIGN\"}")
[ "$VB" != "200" ] || bad "foreign token accepted"
grep -q siso_session "$JAR3" && bad "session issued for wrong code"
ok "wrong code → HTTP $VB, no session"

say "7. recovery code works exactly once"
RC=$(echo "$E" | jq -r '.recoveryCodes[1]')
V2=$(curl -s -c "$JAR3" -b "$JAR3" -X POST $BASE/api/auth/2fa/verify \
  -H 'Content-Type: application/json' -d "{\"recoveryCode\":\"$RC\"}")
expect_true "$(echo "$V2" | jq -r .success)" "recovery verify: $(echo "$V2" | jq -r .error)"
grep -q siso_session "$JAR3" || bad "recovery verify issued no session"
ok "recovery code accepted → session"

say "8. same recovery code cannot be reused"
curl -s -c "$JAR3" -b "$JAR3" -X POST $BASE/api/auth/logout > /dev/null
JAR4=$WORK/s4.cookie
curl -s -c "$JAR4" -b "$JAR4" -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" > /dev/null
VR=$(curl -s -o "$WORK/reuse.json" -w '%{http_code}' -c "$JAR4" -b "$JAR4" -X POST \
  $BASE/api/auth/2fa/verify -H 'Content-Type: application/json' -d "{\"recoveryCode\":\"$RC\"}")
[ "$VR" != "200" ] || bad "recovery code reused"
grep -q siso_session "$JAR4" && bad "session issued for reused code"
ok "reuse blocked → HTTP $VR"

say "9. disable requires the password"
JAR5=$WORK/s5.cookie
curl -s -c "$JAR5" -b "$JAR5" -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" > /dev/null
TOK=$($TSX "$TOKEN" "$SECRET")
V3=$(curl -s -c "$JAR5" -b "$JAR5" -X POST $BASE/api/auth/2fa/verify \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}")
expect_true "$(echo "$V3" | jq -r .success)" "verify for disable"
DWRONG=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR5" -b "$JAR5" -X POST \
  $BASE/api/auth/2fa/disable -H 'Content-Type: application/json' -d '{"password":"definitely-wrong"}')
[ "$DWRONG" != "200" ] || bad "disabled with a wrong password"
D=$(curl -s -c "$JAR5" -b "$JAR5" -X POST $BASE/api/auth/2fa/disable \
  -H 'Content-Type: application/json' -d "{\"password\":\"$PW\"}")
expect_true "$(echo "$D" | jq -r .success)" "disable: $(echo "$D" | jq -r .error)"
ok "wrong password rejected, correct password disabled 2FA"

say "10. sign-in is password-only again"
curl -s -c "$JAR5" -b "$JAR5" -X POST $BASE/api/auth/logout > /dev/null
JAR6=$WORK/s6.cookie
L6=$(curl -s -c "$JAR6" -b "$JAR6" -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
expect_true "$(echo "$L6" | jq -r .success)" "login after disable"
[ "$(echo "$L6" | jq -r .twoFactorRequired)" = "null" ] || bad "still asking for a second factor"
grep -q siso_session "$JAR6" || bad "no session after disable"
ok "password-only sign-in restored (email=$EMAIL)"

echo "$EMAIL" > "$WORK/email"
echo "ALL E2E PASS ($EMAIL)"

say "11. cleanup"
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" src/seed/__smoke-del-user.ts "$EMAIL" >/dev/null)
ok "throwaway account deleted"
