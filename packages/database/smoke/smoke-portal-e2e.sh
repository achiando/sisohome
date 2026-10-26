#!/usr/bin/env bash
# E2E: slice 7 tenant portal (plan-slice-7 §6) —
#   • invite → outbox mail carries /portal/accept?token= ; revoke kills it
#   • fresh accept (new user) → session; portal reads: lease, statement math
#     vs org-side charge, documents (own only), payment instructions
#   • authenticated render of all 7 /portal/* pages → 200 (no Application error)
#   • portal ticket create → org list shows reportedByTenantId; lifecycle
#     PATCH rejected (note-only); cross-tenant ticket 404 + switch-tenant 403
#   • existing-user accept: no session 403 → wrong session 409 → right session
#     ok; dual-role session serves BOTH org APIs and portal APIs
#   • org-less user: / → onboarding redirect, /portal → 200; no session:
#     API 401, page → login, /portal/accept public
#   • rate limit on /api/portal/accept → 429 (LAST — clears on dev restart)
# Run: BASE=http://localhost:3000 ./smoke-portal-e2e.sh
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
STAMP=$(date +%s)
PW='Smoke-Portal-Password!42'
ORG_NAME="Smoke Portal Landlord $STAMP"
PROP_NAME="SMOKE PORTAL Property $STAMP"
EMAIL_OW="smokeportal-ow-$STAMP@example.test"
EMAIL_TA="smokeportal-tenant-a-$STAMP@example.test"

ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; exit 1; }
say() { echo "── $*"; }
expect_true() { [ "$1" = "true" ] || bad "$2 (got: $1)"; }
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
accept_token_from_mail() { # mail file → token
  local url
  url=$(grep -a -oE 'https?://[^"<> ]*portal/accept\?token=[A-Za-z0-9_-]+' "$1" | head -1 || true)
  [ -n "$url" ] || bad "no portal accept link in $1"
  printf '%s' "${url##*token=}"
}

signup_verify() { # email name password jar
  local email=$1 name=$2 pw=$3 jar=$4 R MAIL TOKEN
  R=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$pw\",\"acceptTerms\":true}")
  expect_true "$(jqf .success "$R")" "signup $email"
  mark
  curl -s -X POST $BASE/api/auth/verify-email/resend -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\"}" > /dev/null
  MAIL=$(wait_mail "verify link for $email")
  TOKEN=$(grep -a -oE 'verify-email\?token=[A-Za-z0-9_-]+' "$MAIL" | head -1 | cut -d= -f2)
  [ -n "$TOKEN" ] || bad "no token in mail for $email"
  R=$(curl -s -c "$jar" -X POST $BASE/api/auth/verify-email -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOKEN\"}")
  expect_true "$(jqf .success "$R")" "verify-email $email"
}

BODY=""
CODE=""
req() { # jar method url [json]  → sets CODE + BODY
  local jar=$1 method=$2 url=$3 data=${4:-}
  if [ -n "$data" ]; then
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" "$url" \
      -H 'Content-Type: application/json' -d "$data")
  else
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" "$url")
  fi
  BODY=$(cat "$WORK/body")
}
req_public() { # method url [json] — no cookie jar
  local method=$1 url=$2 data=${3:-}
  if [ -n "$data" ]; then
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' -d "$data")
  else
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -X "$method" "$url")
  fi
  BODY=$(cat "$WORK/body")
}
req_fresh() { # jar method url [json] — send NO cookies, SAVE response cookies
  local jar=$1 method=$2 url=$3 data=${4:-}
  if [ -n "$data" ]; then
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -c "$jar" -X "$method" "$url" \
      -H 'Content-Type: application/json' -d "$data")
  else
    CODE=$(curl -s -o "$WORK/body" -w '%{http_code}' -c "$jar" -X "$method" "$url")
  fi
  BODY=$(cat "$WORK/body")
}
expect_code() { [ "$CODE" = "$1" ] || bad "$2 — expected $1, got $CODE ($BODY)"; }
success_true() {
  local s
  s=$(jqf .success "$BODY")
  [ "$s" = "true" ] || bad "$1 — success=$s error=$(jqf '.error // empty' "$BODY")"
}

echo "workspace: $WORK"
echo "landlord=$EMAIL_OW tenantA=$EMAIL_TA base=$BASE"
echo

say "setup: landlord + org + property + two units + two tenancies"
JAR_OW=$WORK/ow.cookie; signup_verify "$EMAIL_OW" "Smoke Portal OW" "$PW" "$JAR_OW"
req "$JAR_OW" POST $BASE/api/onboarding "{\"name\":\"$ORG_NAME\",\"kind\":\"LANDLORD\"}"
success_true "onboard landlord"
req "$JAR_OW" POST $BASE/api/properties \
  "{\"name\":\"$PROP_NAME\",\"category\":\"RESIDENTIAL\",\"propertyType\":\"APARTMENT\",\"addressLine1\":\"Smoke Portal Rd 1\",\"locality\":\"Smokeville\",\"country\":\"KE\"}"
success_true "create property"
PID=$(jqf .property.id "$BODY"); [ -n "$PID" ] && [ "$PID" != "null" ] || bad "no property id"
req "$JAR_OW" POST $BASE/api/properties/$PID/units '{"unitRef":"PORTAL-A","unitType":"BED_1"}'
success_true "create unit PORTAL-A"
U1=$(jqf .unit.id "$BODY")
req "$JAR_OW" POST $BASE/api/properties/$PID/units '{"unitRef":"PORTAL-B","unitType":"BED_1"}'
success_true "create unit PORTAL-B"
U2=$(jqf .unit.id "$BODY")

req "$JAR_OW" POST $BASE/api/leases/quick \
  "{\"propertyId\":\"$PID\",\"unitId\":\"$U1\",\"startsAt\":\"2026-08-01\",\"endsAt\":\"2027-07-31\",\"monthlyRent\":\"47000\",\"newTenant\":{\"displayName\":\"Smoke Tenant A\",\"email\":\"$EMAIL_TA\",\"phone\":\"+254700000001\"}}"
success_true "quick tenancy A"
L1=$(jqf .lease.id "$BODY"); TA=$(jqf .tenantId "$BODY")
req "$JAR_OW" POST $BASE/api/leases/$L1/approve '{}'
success_true "approve lease 1"
[ "$(jqf .lease.status "$BODY")" = "ACTIVE" ] || bad "lease 1 should be ACTIVE"

req "$JAR_OW" POST $BASE/api/leases/quick \
  "{\"propertyId\":\"$PID\",\"unitId\":\"$U2\",\"startsAt\":\"2026-08-01\",\"endsAt\":\"2027-07-31\",\"monthlyRent\":\"39000\",\"newTenant\":{\"displayName\":\"Smoke Tenant B\",\"email\":\"$EMAIL_OW\",\"phone\":\"+254700000002\"}}"
success_true "quick tenancy B (tenant email = landlord's)"
L2=$(jqf .lease.id "$BODY"); TB=$(jqf .tenantId "$BODY")
req "$JAR_OW" POST $BASE/api/leases/$L2/approve '{}'
success_true "approve lease 2"

say "fixtures: posted charge on A's lease + a ticket reported by tenant B"
ORG_ID=$(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" -e "
    import { prisma } from './src/index'
    prisma.organization.findFirst({ where: { name: '$ORG_NAME' } })
      .then(o => { if (!o) throw new Error('org not found'); console.log(o.id) })
      .finally(() => prisma.\$disconnect())
  " 2>/dev/null | grep -E '^[0-9a-f-]{36}$' | head -1)
[ -n "$ORG_ID" ] || bad "no org id"
FIXTURES=$(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" -e "
    import { prisma } from './src/index'
    ;(async () => {
      const charge = await prisma.charge.create({
        data: {
          organizationId: '$ORG_ID',
          propertyId: '$PID',
          unitId: '$U1',
          leaseId: '$L1',
          tenantId: '$TA',
          chargeType: 'RENT',
          title: 'Smoke portal rent',
          amount: '47000.00',
          currency: 'KES',
          dueDate: new Date('2026-10-05'),
          postedAt: new Date(),
        },
      })
      const ticketB = await prisma.maintenanceTicket.create({
        data: {
          organizationId: '$ORG_ID',
          propertyId: '$PID',
          unitId: '$U2',
          title: 'Smoke cross-tenant ticket',
          category: 'GENERAL',
          priority: 'LOW',
          reportedByTenantId: '$TB',
        },
      })
      console.log('CHARGE_ID=' + charge.id)
      console.log('TICKET_B_ID=' + ticketB.id)
      await prisma.\$disconnect()
    })().catch(e => { console.error(e); process.exit(1) })
  " 2>&1 | grep -E '^CHARGE_ID=|^TICKET_B_ID=') || bad "fixture seed failed"
CHARGE_ID=$(sed -n 's/.*CHARGE_ID=\([0-9a-f-]*\).*/\1/p' <<<"$FIXTURES")
TICKET_B_ID=$(sed -n 's/.*TICKET_B_ID=\([0-9a-f-]*\).*/\1/p' <<<"$FIXTURES")
[ -n "$CHARGE_ID" ] && [ -n "$TICKET_B_ID" ] || bad "fixture ids missing ($FIXTURES)"
ok "charge $CHARGE_ID + tenant-B ticket $TICKET_B_ID seeded"

say "1. invite A → mail carries /portal/accept?token= ; status INVITED"
mark
req "$JAR_OW" POST $BASE/api/tenants/$TA/portal-invite "{\"email\":\"$EMAIL_TA\"}"
expect_code "201" "create invite A"
[ "$(jqf .inviteUrl "$BODY" | grep -c 'portal/accept?token=')" = "1" ] || bad "inviteUrl missing accept path"
MAIL_A=$(wait_mail "portal invite for A")
TOKEN_A=$(accept_token_from_mail "$MAIL_A")
grep -aq "tenant portal is ready" "$MAIL_A" || bad "invite template heading missing"
req "$JAR_OW" GET $BASE/api/tenants/$TA
[ "$(jqf .tenant.portalStatus "$BODY")" = "INVITED" ] || bad "portalStatus should be INVITED"
ok "invite link emailed, portalStatus=INVITED"

say "2. revoke → outstanding token dies (404 on accept)"
req "$JAR_OW" DELETE $BASE/api/tenants/$TA/portal-invite
success_true "revoke invite"
req "$JAR_OW" GET $BASE/api/tenants/$TA
[ "$(jqf .tenant.portalStatus "$BODY")" = "NOT_INVITED" ] || bad "portalStatus should be NOT_INVITED"
req_public POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_A\"}"
expect_code "404" "accept revoked token"   # accept call #1
ok "revoked token → 404, status back to NOT_INVITED"

say "3. re-invite → fresh accept (new user, password) → portal reads"
mark
req "$JAR_OW" POST $BASE/api/tenants/$TA/portal-invite "{\"email\":\"$EMAIL_TA\"}"
expect_code "201" "re-invite A"
MAIL_A2=$(wait_mail "portal re-invite for A")
TOKEN_A2=$(accept_token_from_mail "$MAIL_A2")
[ "$TOKEN_A2" != "$TOKEN_A" ] || bad "re-invite should rotate the token"
JAR_TA=$WORK/ta.cookie
req_fresh "$JAR_TA" POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_A2\",\"password\":\"$PW\"}"
expect_code "200" "accept A"                    # accept call #2
success_true "accept A"
grep -q siso_session "$JAR_TA" || bad "no session cookie issued to A"
req_public POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_A2\"}"
expect_code "409" "replay A token"              # accept call #3
expect_true "$(jqf .alreadyUsed "$BODY")" "alreadyUsed flag on replay"
ok "new user accepted, session issued, replay → 409"

req "$JAR_TA" GET $BASE/api/portal/session
expect_code "200" "portal session A"
[ "$(jqf '.tenants | length' "$BODY")" = "1" ] || bad "A should see 1 tenancy"
[ "$(jqf .tenants[0].id "$BODY")" = "$TA" ] || bad "context tenant mismatch"
[ "$(jqf .profile.email "$BODY")" = "$EMAIL_TA" ] || bad "profile email mismatch"
req "$JAR_TA" GET $BASE/api/portal/lease
expect_code "200" "portal lease A"
[ "$(jqf '.leases | length' "$BODY")" = "1" ] || bad "A should see exactly 1 lease"
[ "$(jqf .leases[0].id "$BODY")" = "$L1" ] || bad "lease id mismatch"
[ "$(jqf .leases[0].units[0].unitRef "$BODY")" = "PORTAL-A" ] || bad "unit ref mismatch"
[ "$(jqf .leases[0].status "$BODY")" = "ACTIVE" ] || bad "lease should be ACTIVE"
[ "$(jqf '.leases[0].units[0].monthlyRent | tonumber' "$BODY")" = "47000" ] || bad "monthly rent mismatch"
ok "session 1 tenancy; lease ACTIVE at 47000/mo"

req "$JAR_TA" GET $BASE/api/portal/statement
expect_code "200" "portal statement A"
expect_true "$(jqf '(.totals.charges | tonumber) == 47000' "$BODY")" "charges total"
expect_true "$(jqf '(.totals.payments | tonumber) == 0' "$BODY")" "payments total"
expect_true "$(jqf '(.totals.balance | tonumber) == 47000' "$BODY")" "balance"
[ "$(jqf '.charges | length' "$BODY")" = "1" ] || bad "expected 1 charge"
[ "$(jqf .charges[0].id "$BODY")" = "$CHARGE_ID" ] || bad "charge id mismatch"
[ "$(jqf '.payments | length' "$BODY")" = "0" ] || bad "no payments expected"
req "$JAR_OW" GET $BASE/api/charges?leaseId=$L1
expect_true "$(jqf "[.charges[] | select(.id==\"$CHARGE_ID\")] | length == 1" "$BODY")" "org-side charge"
expect_true "$(jqf "[.charges[] | select(.id==\"$CHARGE_ID\")][0].amount | tonumber == 47000" "$BODY")" "org-side amount"
ok "statement math matches org-side charge (47000)"

req "$JAR_OW" POST $BASE/api/documents \
  "{\"entityType\":\"LEASE\",\"entityId\":\"$L1\",\"kind\":\"CORRESPONDENCE\",\"storageKey\":\"https://cdn.example.test/smoke/lease-a.pdf\",\"fileName\":\"lease-a.pdf\",\"caption\":\"Signed tenancy\"}"
expect_code "201" "create doc for A's lease"
DOCA=$(jqf .document.id "$BODY")
req "$JAR_OW" POST $BASE/api/documents \
  "{\"entityType\":\"TENANT\",\"entityId\":\"$TB\",\"kind\":\"CORRESPONDENCE\",\"storageKey\":\"https://cdn.example.test/smoke/tenant-b.pdf\",\"fileName\":\"tenant-b.pdf\"}"
expect_code "201" "create doc for tenant B"
DOCB=$(jqf .document.id "$BODY")
req "$JAR_TA" GET $BASE/api/portal/documents
expect_code "200" "portal documents A"
[ "$(jqf '.documents | length' "$BODY")" = "1" ] || bad "A should see only their doc"
[ "$(jqf .documents[0].id "$BODY")" = "$DOCA" ] || bad "wrong doc for A"
[ "$(jqf .documents[0].downloadUrl "$BODY")" = "https://cdn.example.test/smoke/lease-a.pdf" ] || bad "downloadUrl missing"
jqf '.documents[].id' "$BODY" | grep -q "$DOCB" && bad "B's doc leaked to A"
req "$JAR_TA" GET $BASE/api/portal/payment-methods
expect_code "200" "payment instructions"
success_true "payment methods"
[ -n "$(jqf .note "$BODY")" ] || bad "payment note empty"
req "$JAR_TA" GET $BASE/api/portal/tickets
expect_code "200" "tickets list A (empty)"
[ "$(jqf '.tickets | length' "$BODY")" = "0" ] || bad "A starts with no tickets"
ok "documents scoped to A (+downloadUrl), instructions ok, tickets empty"

# authenticated RENDER of every portal page (server shell + frame + client app)
for p in /portal /portal/lease /portal/statement /portal/documents /portal/payment /portal/profile /portal/tickets; do
  rc=$(curl -s -o "$WORK/page.html" -w '%{http_code}' -b "$JAR_TA" -c "$JAR_TA" --max-time 60 "$BASE$p")
  [ "$rc" = "200" ] || bad "render $p → HTTP $rc"
  grep -q "Application error" "$WORK/page.html" && bad "render $p shows Application error"
done
ok "portal pages render 200 with A's session (home/lease/statement/documents/payment/profile/tickets)"

say "4. portal ticket create → org sees reportedByTenantId; status PATCH rejected"
req "$JAR_TA" POST $BASE/api/portal/tickets \
  "{\"unitId\":\"$U1\",\"title\":\"Kitchen tap is leaking\",\"description\":\"Water under the sink\",\"category\":\"PLUMBING\",\"priority\":\"HIGH\"}"
expect_code "201" "create portal ticket"
TID=$(jqf .ticket.id "$BODY")
[ -n "$TID" ] && [ "$TID" != "null" ] || bad "no ticket id"
[ "$(jqf .ticket.status "$BODY")" = "OPEN" ] || bad "ticket should start OPEN"
req "$JAR_OW" GET $BASE/api/maintenance/tickets
expect_code "200" "org ticket list"
expect_true "$(jqf "[.tickets[] | select(.id==\"$TID\")] | length == 1" "$BODY")" "org sees portal ticket"
expect_true "$(jqf "[.tickets[] | select(.id==\"$TID\")][0].reportedByTenantId == \"$TA\"" "$BODY")" "reportedByTenantId set"
ok "org list shows the portal ticket with reportedByTenantId"

req "$JAR_TA" PATCH $BASE/api/portal/tickets/$TID '{"status":"CLOSED"}'
expect_code "400" "lifecycle PATCH rejected"
req "$JAR_TA" GET $BASE/api/portal/tickets/$TID
expect_code "200" "ticket detail"
[ "$(jqf .ticket.status "$BODY")" = "OPEN" ] || bad "status must stay OPEN"
req "$JAR_TA" PATCH $BASE/api/portal/tickets/$TID '{"note":"When can someone come by?"}'
expect_code "200" "append note"
[ -n "$(jqf .note.id "$BODY")" ] || bad "no note id"
req "$JAR_TA" GET $BASE/api/portal/tickets/$TID
[ "$(jqf '.ticket.notes | length' "$BODY")" = "1" ] || bad "thread should have 1 note"
[ "$(jqf .ticket.notes[0].author "$BODY")" = "tenant" ] || bad "note author"
ok "status PATCH → 400, note append → thread grows"

say "5. cross-tenant isolation"
req "$JAR_TA" GET $BASE/api/portal/tickets/$TICKET_B_ID
expect_code "404" "B's ticket via A's session"
req "$JAR_TA" POST $BASE/api/portal/switch-tenant "{\"tenantId\":\"$TB\"}"
expect_code "403" "switch to B rejected"
req "$JAR_TA" GET $BASE/api/portal/lease
[ "$(jqf '.leases | length' "$BODY")" = "1" ] || bad "A lease list must stay single"
[ "$(jqf '.leases[0].id' "$BODY")" = "$L1" ] || bad "A must not see B's lease"
ok "404 on B's ticket, 403 on switch-tenant, list stays A's"

say "6. existing-user accept: 403 no session → 409 wrong session → dual-role ok"
mark
req "$JAR_OW" POST $BASE/api/tenants/$TB/portal-invite "{\"email\":\"$EMAIL_OW\"}"
expect_code "201" "invite B to the landlord's own email"
MAIL_B=$(wait_mail "portal invite for B")
TOKEN_B=$(accept_token_from_mail "$MAIL_B")
JAR_NONE=$WORK/none.cookie; touch "$JAR_NONE"
req_public POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_B\"}"
expect_code "403" "existing user without session"   # accept call #4
[ "$(jqf .redirectTo "$BODY" | grep -c '/login?next=')" = "1" ] || bad "redirectTo missing"
req "$JAR_TA" POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_B\"}"
expect_code "409" "wrong session → needsLogout"     # accept call #5
expect_true "$(jqf .needsLogout "$BODY")" "needsLogout flag"
req "$JAR_OW" POST $BASE/api/portal/accept "{\"token\":\"$TOKEN_B\"}"
expect_code "200" "landlord accepts own invite"     # accept call #6
success_true "accept B"
expect_true "$(jqf .alreadySignedIn "$BODY")" "session kept (alreadySignedIn)"
ok "403 → 409 → 200 (existing-user flow, no session swap)"

req "$JAR_OW" GET $BASE/api/portal/session
expect_code "200" "portal session for dual-role"
[ "$(jqf '.tenants | length' "$BODY")" = "1" ] || bad "landlord should see 1 tenancy (B)"
[ "$(jqf .tenants[0].id "$BODY")" = "$TB" ] || bad "should be tenant B"
req "$JAR_OW" GET $BASE/api/portal/lease
expect_code "200" "portal lease for dual-role"
[ "$(jqf '.leases[0].id' "$BODY")" = "$L2" ] || bad "dual-role should see B's lease"
req "$JAR_OW" GET $BASE/api/maintenance/tickets
expect_code "200" "org API still works on the same session"
req "$JAR_OW" GET $BASE/api/properties
expect_code "200" "org list still works"
req "$JAR_OW" POST $BASE/api/tenants/$TA/portal-invite "{\"email\":\"$EMAIL_TA\"}"
expect_code "409" "re-invite an ACTIVE portal tenant blocked"
ok "dual-role session serves portal + org APIs; ACTIVE re-invite → 409"

say "7. org-less routing + unauthenticated gates"
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JAR_TA" $BASE/)
grep -q '/onboarding' <<<"$LOC" || bad "org-less / should redirect to onboarding, got: $LOC"
CODE=$(curl -s -o "$WORK/p.html" -w '%{http_code}' -b "$JAR_TA" $BASE/portal)
[ "$CODE" = "200" ] || bad "org-less /portal → 200, got $CODE"
grep -q "Opening your portal\|SisoHome" "$WORK/p.html" || bad "portal shell missing"
req_public GET $BASE/api/portal/session
expect_code "401" "portal API without session"
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' $BASE/portal)
grep -q '/login' <<<"$LOC" || bad "unauth /portal should bounce to login, got: $LOC"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/portal/accept?token=bogus")
[ "$CODE" = "404" ] || bad "public accept page should reach the app (404 for bad token), got $CODE"
ok "org-less / → onboarding, /portal → 200, unauth API 401, accept page public"

say "8. rate limit on /api/portal/accept (LAST)"
SAW429=0
for i in $(seq 1 8); do
  req_public POST $BASE/api/portal/accept "{\"token\":\"bogus-$i-$STAMP\"}"
  if [ "$CODE" = "429" ]; then SAW429=1; break; fi
done
[ "$SAW429" = "1" ] || bad "expected 429 within 8 attempts (used 6 already)"
ok "429 after the 10-per-10min budget (restart dev server to reset)"

say "9. cleanup"
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" -e "
    import { prisma } from './src/index'
    ;(async () => {
      const orgs = await prisma.organization.findMany({ where: { name: '$ORG_NAME' } })
      const orgIds = orgs.map(o => o.id)
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.maintenanceTicketNote.deleteMany({ where: { ticket: { organizationId: { in: orgIds } } } })
      await prisma.maintenanceTicket.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.charge.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.propertyDocument.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.leaseTenant.deleteMany({ where: { lease: { organizationId: { in: orgIds } } } })
      await prisma.leaseUnit.deleteMany({ where: { lease: { organizationId: { in: orgIds } } } })
      await prisma.lease.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.tenantPortalInvite.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.tenant.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.propertyStaffAssignment.deleteMany({ where: { property: { portfolioOrganizationId: { in: orgIds } } } })
      await prisma.propertyManagementAgreement.deleteMany({ where: { property: { portfolioOrganizationId: { in: orgIds } } } })
      await prisma.propertyOwnership.deleteMany({ where: { property: { portfolioOrganizationId: { in: orgIds } } } })
      await prisma.property.deleteMany({ where: { portfolioOrganizationId: { in: orgIds } } })
      await prisma.propertyOwnerParty.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
      console.log('cleaned orgs:', orgIds.length)
      await prisma.\$disconnect()
    })().catch(e => { console.error(e); process.exit(1) })
  " 2>&1 | grep -v -e Warning -e trace-deprecation) || bad "db cleanup failed"
for e in "$EMAIL_OW" "$EMAIL_TA"; do
  (cd "$ROOT/packages/database" && set -a && source .env && set +a && \
    "$TSX" src/seed/__smoke-del-user.ts "$e" >/dev/null 2>&1) || bad "user cleanup $e"
done
ok "throwaway users + org + fixtures removed"

echo
echo "ALL PASS — slice 7 tenant portal (invite/accept, portal reads, isolation, dual-role, rate limit)"
