#!/usr/bin/env bash
# E2E: slice 1 property domain (plan-slice-1 §6) —
#   • cross-kind property lists: PM/MM/MK see [] until related; detail/PATCH 404
#   • staff assignment arm 3 on/off (MM user assigned → sees, revoked → [])
#   • dual-entry agreement: PM propose-side approve → 403, owner approves →
#     PM list = 1, detail 200, PATCH 200
#   • units: duplicate unitRef 409, bulk conflict 409 lists refs,
#     delete property with units 409, draft delete 200
#   • documents: upload → list (owner + scoped manager) → cover winner → delete
# Run: BASE=http://localhost:3001 ./smoke-property-e2e.sh
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
ROOT=/home/tijwa/projects/work/tijwa/sisohomes
TSX=$ROOT/packages/database/node_modules/.bin/tsx
OUTBOX_DIRS="$ROOT/apps/web/.email-outbox $ROOT/.email-outbox"
WORK=$(mktemp -d)
STAMP=$(date +%s)
PW='Smoke-Property-Password!42'
ORG_A="Smoke Landlord $STAMP"
ORG_B="Smoke PM Co $STAMP"
ORG_C="Smoke MM Co $STAMP"
ORG_D="Smoke MK Co $STAMP"
PROP_NAME="SMOKE E2E Property $STAMP"
DRAFT_NAME="SMOKE E2E Draft $STAMP"
EMAIL_A="smokeprop-a-$STAMP@example.test"
EMAIL_B="smokeprop-b-$STAMP@example.test"
EMAIL_C="smokeprop-c-$STAMP@example.test"
EMAIL_D="smokeprop-d-$STAMP@example.test"

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
expect_code() { [ "$CODE" = "$1" ] || bad "$2 — expected $1, got $CODE ($BODY)"; }
success_true() {
  local s
  s=$(jqf .success "$BODY")
  [ "$s" = "true" ] || bad "$1 — success=$s error=$(jqf '.error // empty' "$BODY")"
}

echo "workspace: $WORK"
echo "landlord=$EMAIL_A pm=$EMAIL_B mm=$EMAIL_C mk=$EMAIL_D base=$BASE"
echo

say "setup: 4 accounts + orgs (LANDLORD / PM / MM / MK)"
JAR_A=$WORK/a.cookie; signup_verify "$EMAIL_A" "Smoke Prop A" "$PW" "$JAR_A"
req "$JAR_A" POST $BASE/api/onboarding "{\"name\":\"$ORG_A\",\"kind\":\"LANDLORD\"}"; success_true "onboard landlord"
JAR_B=$WORK/b.cookie; signup_verify "$EMAIL_B" "Smoke Prop B" "$PW" "$JAR_B"
req "$JAR_B" POST $BASE/api/onboarding "{\"name\":\"$ORG_B\",\"kind\":\"PROPERTY_MANAGEMENT\"}"; success_true "onboard PM"
JAR_C=$WORK/c.cookie; signup_verify "$EMAIL_C" "Smoke Prop C" "$PW" "$JAR_C"
req "$JAR_C" POST $BASE/api/onboarding "{\"name\":\"$ORG_C\",\"kind\":\"MAINTENANCE_COMPANY\"}"; success_true "onboard MM"
JAR_D=$WORK/d.cookie; signup_verify "$EMAIL_D" "Smoke Prop D" "$PW" "$JAR_D"
req "$JAR_D" POST $BASE/api/onboarding "{\"name\":\"$ORG_D\",\"kind\":\"MARKETING_AGENT\"}"; success_true "onboard MK"
ok "all four sessions active"

user_id() { req "$1" GET $BASE/api/auth/session; jqf .user.id "$BODY"; }
C_UID=$(user_id "$JAR_C")

say "1. landlord creates property (DRAFT)"
req "$JAR_A" POST $BASE/api/properties \
  "{\"name\":\"$PROP_NAME\",\"category\":\"RESIDENTIAL\",\"propertyType\":\"APARTMENT\",\"addressLine1\":\"Smoke Rd 7\",\"locality\":\"Smokeville\",\"country\":\"KE\"}"
success_true "POST /api/properties"
PID=$(jqf .property.id "$BODY")
[ -n "$PID" ] && [ "$PID" != "null" ] || bad "no property id"
[ "$(jqf .property.status "$BODY")" = "DRAFT" ] || bad "status should default to DRAFT"
req "$JAR_A" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" -ge 1 ] || bad "landlord list should include the property"
ok "property $PID created, landlord list ≥ 1"

say "2. cross-kind lists before any relationship"
req "$JAR_B" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "0" ] || bad "PM should see [] pre-agreement"
ok "PM list = []"
req "$JAR_B" GET $BASE/api/properties/$PID
expect_code "404" "PM detail pre-agreement"
req "$JAR_C" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "0" ] || bad "MM should see [] with no agreement/jobs"
ok "MM list = []"
req "$JAR_C" PATCH $BASE/api/properties/$PID '{"name":"hijack"}'
expect_code "404" "MM PATCH out of scope"
req "$JAR_D" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "0" ] || bad "MK should see [] (listing projection only)"
ok "MK list = []"

say "3. staff assignment (arm 3) — MM user assigned then revoked"
req "$JAR_A" POST $BASE/api/properties/$PID/staff "{\"userId\":\"$C_UID\"}"
success_true "POST staff"
ASSIGN_ID=$(jqf .assignment.id "$BODY")
req "$JAR_C" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "1" ] || bad "assigned staff should see the property"
ok "assigned MM user sees property"
req "$JAR_A" POST $BASE/api/staff-assignments/$ASSIGN_ID/revoke
success_true "revoke staff"
req "$JAR_C" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "0" ] || bad "revoked staff should see []"
ok "revoked MM user sees [] again"
req "$JAR_C" PATCH $BASE/api/properties/$PID '{"name":"hijack again"}'
expect_code "404" "MM PATCH after revoke"

say "4. agreement dual-entry (owner creates → PM approve 403 → owner approves)"
req "$JAR_A" POST $BASE/api/owner-parties \
  '{"partyType":"COMPANY","name":"Smoke E2E Owners Ltd"}'
success_true "create owner party"
PARTY_ID=$(jqf .party.id "$BODY")
req "$JAR_A" GET $BASE/api/organizations
success_true "GET /api/organizations (agreement.create)"
ORG_B_ID=$(jq -r --arg n "$ORG_B" '.organizations[] | select(.name==$n) | .id' <<<"$BODY")
[ -n "$ORG_B_ID" ] && [ "$ORG_B_ID" != "null" ] || bad "PM org missing from manager directory"
BAD_KINDS=$(jq -r '.organizations[].kind' <<<"$BODY" | grep -cv -E '^(PROPERTY_MANAGEMENT|MAINTENANCE_COMPANY)$' || true)
[ "$BAD_KINDS" = "0" ] || bad "directory leaked $BAD_KINDS non-managing kind(s)"
ok "directory only managing kinds"
req "$JAR_A" POST $BASE/api/properties/$PID/agreements \
  "{\"managementOrganizationId\":\"$ORG_B_ID\",\"ownerPartyId\":\"$PARTY_ID\"}"
success_true "create agreement DRAFT"
AID=$(jqf .agreement.id "$BODY")
[ "$(jqf .agreement.status "$BODY")" = "DRAFT" ] || bad "agreement should be DRAFT"
req "$JAR_B" POST $BASE/api/agreements/$AID/approve
expect_code "403" "PM approve attempt"
ok "PM approve blocked (403)"
req "$JAR_A" POST $BASE/api/agreements/$AID/approve
success_true "owner approve"
[ "$(jqf .agreement.status "$BODY")" = "ACTIVE" ] || bad "agreement should be ACTIVE"
req "$JAR_B" GET $BASE/api/properties
[ "$(jqf '.properties | length' "$BODY")" = "1" ] || bad "PM list should be 1 after approval"
ok "PM list = 1"
req "$JAR_B" GET $BASE/api/properties/$PID
expect_code "200" "PM detail after approval"
req "$JAR_B" PATCH $BASE/api/properties/$PID "{\"name\":\"$PROP_NAME (managed)\"}"
success_true "PM PATCH managed property"
ok "PM detail 200 + PATCH 200"

say "5. units: duplicate 409, bulk conflict 409, delete guards"
req "$JAR_A" POST $BASE/api/properties/$PID/units '{"unitRef":"E2E-1","unitType":"BED_1"}'
success_true "create unit E2E-1"
req "$JAR_A" POST $BASE/api/properties/$PID/units '{"unitRef":"E2E-1","unitType":"BED_1"}'
expect_code "409" "duplicate unitRef"
ok "duplicate unitRef → 409"
req "$JAR_A" POST $BASE/api/properties/$PID/units/bulk \
  '{"prefix":"E2E-","from":2,"to":5,"defaults":{"unitType":"BED_1"}}'
success_true "bulk create E2E-2..5"
[ "$(jqf .created "$BODY")" = "4" ] || bad "bulk should create 4"
req "$JAR_A" POST $BASE/api/properties/$PID/units/bulk \
  '{"prefix":"E2E-","from":1,"to":3,"defaults":{"unitType":"BED_1"}}'
expect_code "409" "bulk conflict"
jqf .error "$BODY" | grep -q "E2E-1" || bad "409 should list conflicting refs ($BODY)"
ok "bulk conflict 409 lists refs"
req "$JAR_A" DELETE $BASE/api/properties/$PID
expect_code "409" "delete property with units"
ok "delete with units → 409"

say "6. documents (upload → list → cover → scoped manager read → delete)"
req "$JAR_A" POST $BASE/api/documents \
  "{\"entityType\":\"PROPERTY\",\"entityId\":\"$PID\",\"kind\":\"PHOTO\",\"storageKey\":\"properties/$PID/a.jpg\",\"fileName\":\"a.jpg\",\"isCover\":true,\"caption\":\"front\"}"
expect_code "201" "create doc #1"
DOC1=$(jqf .document.id "$BODY")
req "$JAR_A" POST $BASE/api/documents \
  "{\"entityType\":\"PROPERTY\",\"entityId\":\"$PID\",\"kind\":\"PHOTO\",\"storageKey\":\"properties/$PID/b.jpg\",\"fileName\":\"b.jpg\",\"isCover\":true}"
expect_code "201" "create doc #2 (cover)"
DOC2=$(jqf .document.id "$BODY")
req "$JAR_A" GET "$BASE/api/documents?entityType=PROPERTY&entityId=$PID"
success_true "list documents"
[ "$(jqf '.documents | length' "$BODY")" -ge 2 ] || bad "list should include both docs"
COVERS=$(jqf '[.documents[] | select(.isCover==true)] | length' "$BODY")
[ "$COVERS" = "1" ] || bad "exactly one cover expected, got $COVERS"
[ "$(jq -r --arg id "$DOC2" '.documents[0].id' <<<"$BODY")" = "$DOC2" ] || bad "cover should sort first"
ok "single cover winner, cover first"
req "$JAR_B" GET "$BASE/api/documents?entityType=PROPERTY&entityId=$PID"
expect_code "200" "manager (arm 2) lists documents"
ok "PM lists documents via agreement scope"
req "$JAR_D" GET "$BASE/api/documents?entityType=PROPERTY&entityId=$PID"
expect_code "404" "MK sees no property documents"
req "$JAR_A" DELETE $BASE/api/documents/$DOC1
success_true "delete doc #1"
req "$JAR_A" DELETE $BASE/api/documents/$DOC2
success_true "delete doc #2"

say "7. draft property delete → 200"
req "$JAR_A" POST $BASE/api/properties \
  "{\"name\":\"$DRAFT_NAME\",\"category\":\"RESIDENTIAL\",\"propertyType\":\"APARTMENT\",\"addressLine1\":\"Smoke Rd 9\",\"locality\":\"Smokeville\",\"country\":\"KE\"}"
success_true "create draft property"
DRAFT_ID=$(jqf .property.id "$BODY")
req "$JAR_A" DELETE $BASE/api/properties/$DRAFT_ID
success_true "delete empty draft → 200"
ok "draft delete → 200"

say "8. cleanup (property rows, parties, orgs, users)"
(cd "$ROOT/packages/database" && set -a && source .env && set +a && \
  "$TSX" -e "
    import { prisma } from './src/index'
    ;(async () => {
      const orgs = await prisma.organization.findMany({ where: { name: { in: ['$ORG_A','$ORG_B','$ORG_C','$ORG_D'] } }, select: { id: true } })
      const orgIds = orgs.map(o => o.id)
      const props = await prisma.property.findMany({ where: { name: { startsWith: 'SMOKE E2E' } }, select: { id: true } })
      const propIds = props.map(p => p.id)
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.propertyDocument.deleteMany({ where: { propertyId: { in: propIds } } })
      await prisma.propertyStaffAssignment.deleteMany({ where: { propertyId: { in: propIds } } })
      await prisma.propertyManagementAgreement.deleteMany({ where: { propertyId: { in: propIds } } })
      await prisma.propertyOwnership.deleteMany({ where: { propertyId: { in: propIds } } })
      await prisma.property.deleteMany({ where: { id: { in: propIds } } })
      await prisma.propertyOwnerParty.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
      console.log('cleaned:', propIds.length, 'properties,', orgIds.length, 'orgs')
      await prisma.\$disconnect()
    })().catch(e => { console.error(e); process.exit(1) })
  " 2>&1 | grep -v -e Warning -e trace-deprecation) || bad "db cleanup failed"
for e in "$EMAIL_A" "$EMAIL_B" "$EMAIL_C" "$EMAIL_D"; do
  (cd "$ROOT/packages/database" && set -a && source .env && set +a && \
    "$TSX" src/seed/__smoke-del-user.ts "$e" >/dev/null 2>&1) || bad "user cleanup $e"
done
ok "throwaway users + orgs removed"

echo
echo "ALL PASS — slice 1 property domain API smoke"
