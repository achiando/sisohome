# STATUS.md — Living Project State

**The session-agnostic source of truth for what exists right now, what's verified, what's broken, and where every other document lives.**

Rules for this doc (extend, don't rewrite):
- Read it at the **start** of any session; update the snapshot + tables at the **end** of every work block, committed together with the work.
- Other docs own *scope* (`BUILD.md`), *reuse* (`ADOPTION.md`), *domain design* (`property.md`), *rules* (`AGENTS.md`) — **this doc owns "current state"** and links to all of them.
- No secrets, no environment values — only key names. Repo-relative paths only.
- Add rows to the tables; don't delete history unless it's factually superseded (mark it so).

Snapshot: **2026-10-20 20:22** · branch `main` @ `d034f58` · working tree **dirty** — Phase-2 batches 1–5 (property + tenancy + applications/ledger + operations + marketing/sales schema/seeds) + research docs + STATUS edits, all uncommitted

---

## 1. Doc map — where knowledge lives

| Document | Owns |
| --- | --- |
| **`STATUS.md` (this file)** | Current state, verification status, blockers, operating playbook, links |
| `AGENTS.md` | Mandatory rules injected into *every* session (auth security, UI system, Next.js). Points here |
| `BUILD.md` | What we're building, in what order, acceptance gates (single source of scope) |
| `ADOPTION.md` | How to reuse this foundation for other verticals (retail, wholesale…) + effort table |
| `property.md` | Phase-2 property-domain design (property/unit/lease/ledger model decisions) |
| `research-property-1.md` | Phase-2 research: domain permission catalog (B/P/F tiers), role→key assignments per org kind, enforcement recipes, full page/nav inventory |
| `research-property-2.md` | Phase-2 research: Property/Building/Unit field lists, Google Maps pin spec (keyless deep links + capture UX), Zillow & Kenya-platform field parity |
| `research-property-3.md` | Phase-2 research: property-type taxonomy + behavior matrix (incl. mall & land), ownership models incl. strata/multi-owner & PM agreements, tenant management model |
| `research-property-4.md` | Phase-2 research: sale workflow (pipeline stages, Listing/Lead/Viewing/Offer/Deal records), Kenya land-sale checklist, marketing-agent handoff, `/sales` pages |
| **`plan-api-ui.md`** (index) + `plan-slice-0..7-*.md` | Phase-2 **API + UI build plan**: per-slice route/page inventory, shared create/edit form pattern, property-scope scoping rules, assignment model, acceptance smokes. Governs the next work phase |
| `db.md` | *(empty — reserved)* |
| `packages/database/FOUNDATION_SUMMARY.md` | Authorization foundation — **partially historical**; where it conflicts with `AGENTS.md` (route protection), **AGENTS.md wins** |
| `packages/database/SECURITY.md` · `AUTH_ARCHITECTURE.md` · `INTEGRATION_GUIDE.md` | Deep auth/security reference for the database package |
| `siso-design/design.json` | Design system source for `apps/web` UI |
| `README.md` | Upstream template boilerplate (not project-specific) |

## 2. Apps & packages

| App | Purpose | Dev port | State |
| --- | --- | --- | --- |
| `apps/web` | SisoHome property product (Phase 1 complete) | **3000 intended** — currently running on fallback **3001** (see blockers) | Built, verified |
| `apps/sisohome-admin` | Full duplicate of `web` = cross-vertical template (per `ADOPTION.md`) | **3001** (`next dev --port 3001`) | Committed `777c74b`, typecheck ✓, lint 0 errors, boots `/login` 200 |

Packages: `@workspace/database` (schema, Prisma, access/tenancy layer, seeders), `@workspace/ui` (99 components + `UniversalForm`), `@workspace/auth-ui`, `@workspace/email` (template engine; copy lives in each app), plus configs.

## 3. What is built & verified

### Phase 1 — complete
Auth (signup → email verification → login → sessions, password reset/change, login alerts) · 2FA (TOTP + email code + recovery codes) · People management (invite, temp password, status, role assignment) · Roles & permissions editor with matrix · Settings/profile (email immutable) · org switcher, single-org rule for ownership roles (`SINGLE_ORG_ROLE_SLUGS`) · mobile shell (bottom tab bar, sheet nav) · PWA (manifest + sw) · Terms/Privacy pages · onboarding + org creation with kind picker.

### Phase 2 — batch 1: property schema + domain permissions (built & verified 2026-10-20, uncommitted)
Physical-asset layer only (lease/tenancy/finance/utility/sales = later batches). Sources: `property.md`, `research-property-1..4.md`.

- **Schema** (`packages/database/prisma/schema.prisma`, +14 enums / +9 models): `Property` (`portfolioOrganizationId` per BUILD.md & sisohome-1 §4; `@@unique([portfolioOrganizationId, code])`; identity/location+pin/legal-title/physical/media fields; `defaults`+`attributes` Json) · `Building` · `Unit` (templates only — never rewrite live leases) · `UnitType` (bulk-onboarding catalog) · `PropertyOwnerParty` (person/company/association/org) · `PropertyOwnership` (`propertyId?`/`unitId?` XOR — strata unit-level vs whole-property; `sharePercent`, `unitFactor`, `titleNumber`; active window = `startsAt`/`endsAt`, no status enum) · `PropertyManagementAgreement` (PM authorization: status/dates/`managementOrganizationId`; `scope` Json never authoritative) · `PropertyStaffAssignment` (caretaker row-scope; rides existing `relationship.*` keys) · `PropertyDocument` (polymorphic `entityType`/`entityId` + `kind` incl. PHOTO gallery: `caption`/`sortOrder`/`isCover`; private `storageKey`; `version`).
- **Tenancy rule**: child rows carry `organizationId` = the property's portfolio org; PM orgs reach rows **only** via a valid agreement join (permission ∧ relationship). Audits reuse generic `AuditLog`/`AuditService` (`resourceType: 'property' | 'unit' | …`) — no per-domain audit table.
- **Deferred deliberately**: Tenant/Lease/Charge models & keys; sales pipeline (research-4); `PropertyAgentAssignment` (listing batch); derived fields (occupancy, `totalUnits`, balances — computed, never stored); `createdBy`/`archivedAt` columns (status enum + AuditLog cover them); `plusCode`/`nearby`/`boundary`/`constructionType` fields.
- **Permissions**: catalog **45 → 71** — +`property.*`(7) `unit.*`(6) `ownership.*`(4) `agreement.*`(5) `document.*`(4) in `foundation-permissions.ts`; `PermissionAction.UPLOAD` + `ResourceType.{PROPERTY,UNIT,OWNERSHIP,AGREEMENT}` added in `authorization/types.ts`.
- **Role enrichment** (`org-kind-templates.ts`, per research-property-1 §2 matrix): every kind's `owner` gets all 26 domain keys (identical sets — matrix guard enforces); LANDLORD `manager` 16; PM `property_manager` 19, `finance_officer`/`leasing_officer` 7, `caretaker`/`maintenance_coordinator` 5, `technician` 2; MK `owner` = property.*+document.* only (no unit/ownership/agreement).
- **Verified**: `prisma validate` ✓ · `db push` (remote) ✓ · `prisma generate` ✓ · matrix-guard test ✓ · `db:seed` → 71 keys, live spot-check example-org LANDLORD (owner 26 / manager 16 / viewer 10) ✓ · `npx tsc -p packages/database` ✓ · `pnpm typecheck` 9/9 ✓ · `pnpm lint` 9/9 (3 pre-existing web warnings) ✓. E2E smokes not re-run — schema change is purely additive.

### Phase 2 — batch 2: tenancy foundation + portal-ready tenants (built & verified 2026-10-20, uncommitted)
`Tenant`/`Lease` layer per BUILD.md Phase 2 + research-property-3 §4. Org linkage follows the batch-1 rule (every row carries `organizationId` = the property's portfolio org; PM orgs reach rows only via agreement join).

- **Schema** (+8 enums, +6 models): `Tenant` (party record ≠ `User`: identity/KRA/ID, employment flags, emergency contact, preferred channel defaulting to WHATSAPP, internal `notes`; statuses PROSPECT/APPLICANT/ACTIVE/PAST — blacklisting deferred per research §6.5) · `Lease` (lifecycle DRAFT→PENDING_APPROVAL→SCHEDULED→ACTIVE→ENDING→TERMINATED/CLOSED/CANCELLED; `tenureType` LEASE/LICENSE for kiosk/ATM casual occupation; `renewalOfId` self-FK — renewals are new leases, never mutations; periodic tenancy = null `endsAt`; unit-overlap prevention is an API-transaction rule, noted in schema) · `LeaseUnit` (per-unit rent/deposit/frequency — a lease may span units with different rents) · `LeaseTenant` (relationship PRIMARY/JOINT/GUARANTOR/OCCUPANT — joint tenants are extra rows, never a duplicated lease) · `TenantPortalInvite` (single-use SHA-256 hashed token, same one-shot pattern as `EmailVerificationToken`) · `DocumentVersion` (replace-history for `PropertyDocument` — this is BUILD.md's "LeaseDocument/DocumentVersion": lease docs = `PropertyDocument(entityType=LEASE)` + versions; no parallel document model). `DocumentEntityType` += TENANT/LEASE; `DocumentKind` += TENANCY_AGREEMENT/DEPOSIT_RECEIPT/NOTICE/INVENTORY_REPORT. Tenant delete is DB-blocked while leases exist (`LeaseTenant.tenantId` Restrict).
- **Tenant portal (user type handled at schema level, UI later)**: `Tenant.portalUserId` → `User` (nullable, SetNull; many tenants per user allowed — a person can be staff of one org and tenant of another) + `portalStatus` NOT_INVITED→INVITED→ACTIVE→SUSPENDED + `portalInvitedAt`/`portalActivatedAt`. Portal sign-in reuses the normal `User`/`Session` stack with `Session.organizationId = null`; a future portal guard resolves the tenant via the user link and scopes to their `LeaseTenant` rows; org routes already require active membership, so portal-only users are structurally isolated from the org app. Invite redemption proves email → linked `User` gets `emailVerifiedAt`.
- **Permissions**: catalog **71 → 83** — +`tenant.*`(6) `lease.*`(6); `ResourceType` += `TENANT`, `LEASE`.
- **Role enrichment** (research-property-1 §2): owner all 12 (identical across LANDLORD/PM/MM — matrix guard; MM owner holds keys but reaches zero rows without a portfolio relationship) · LANDLORD manager + PM prop_mgr/leasing = tenant create/read/list/update + lease create/read/list/update/approve · finance roles + admin + member/viewer = read/list · caretaker += `tenant.read` (site contact) · MM non-owners and all MK roles get **no** tenancy keys (PII stays out of maintenance/marketing orgs).
- **Verified**: `prisma validate` ✓ · `db push` ✓ · `generate` ✓ · matrix-guard test ✓ · `db:seed` → 83 keys, live spot-check example-org LANDLORD (owner 12 / manager 9 / viewer 4 tenancy keys) ✓ · `tsc -p packages/database` ✓ · `pnpm typecheck` 9/9 ✓ · `pnpm lint` 9/9 ✓. E2E smokes not re-run — additive schema only.

### Phase 2 — batches 3–5: applications/ledger + operations + marketing/sales (built & verified 2026-10-20, uncommitted)
Completes the property-domain DB layer (all 5 planned batches). Org linkage rule unchanged: child rows carry `organizationId` = the property's portfolio org; PM orgs via `PropertyManagementAgreement`, MM orgs via `WorkOrderAssignment.assigneeOrganizationId`, MK orgs via `Listing.marketingOrganizationId` + `Handoff` relationship rows. Cross-org access is permission ∧ relationship, never permission alone.

- **Schema batch 3** (+7 enums, +8 models): `RentalApplication` (SUBMITTED→…→APPROVED/REJECTED; `applicantTenantId`, optional `unitId`, plain-uuid `decidedByUserId`, `leaseId` conversion link) · `ChargeSchedule` (recurring rule — WHAT/WHEN, XOR lease|property|unit scope enforced at API; `charges` back-ref) · `Charge` (amount owed; balance DERIVED, never stored; `postedAt` null = draft; `scheduleId` source trace) · `Payment` (method incl. MPESA/CASH/BANK_TRANSFER; reconciliation actors as plain uuids) · `PaymentAllocation` (partial/multi/unallocated) · `FinancialAdjustment` (CREDIT/WAIVER/REVERSAL/WRITE_OFF; PENDING→APPROVED/REJECTED — submit ≠ approve) · `PropertyExpense` (owner-paid money-out; SUBMITTED→APPROVED→PAID) · `Receipt` (issued once, never edited; `@@unique([organizationId, receiptNumber])`).
- **Schema batch 4** (+9 enums, +5 models): `MaintenanceTicket` (+`reportedByTenantId` → portal tenant) · `WorkOrder` (PENDING→AUTHORIZED→…→COMPLETED/CANCELLED; costs) · `WorkOrderAssignment` (named `WorkOrderAssigneeOrg` — the MM cross-org row) · `Inspection` (kind/status/findings; `inspectorUserId` → User, `@db.Uuid`) · `RecurringSchedule` (INSPECTION/VISIT/CLEANING/MAINTENANCE × DAILY…QUARTERLY).
- **Schema batch 5** (+13 enums, +7 models): `Listing` (named `ListingPortfolio`/`ListingMarketing`; SALE/RENT; commission terms; price changes = `ListingPriceHistory` events, never silent overwrites) · `Lead` (capturing org immutable — handoff never re-points) · `Handoff` (named `HandoffFrom`/`HandoffTo`; OFFERED→ACCEPTED/DECLINED/EXPIRED) · `PropertyViewing` (+`tenantId` for renewal viewings) · `Offer` (counters = NEW rows via named `OfferCounter` self-FK; `deal PropertyDeal?` 1-1) · `PropertyDeal` (AGREED→…→COMPLETED/COLLAPSED; `buyerOwnerPartyId`; completion writes the ownership transfer at the API layer). `DocumentEntityType` += APPLICATION/EXPENSE/WORK_ORDER/INSPECTION/LISTING/DEAL; `DocumentKind` += PAYSLIP/BANK_STATEMENT/VALUATION_REPORT.
- **Permissions**: catalog **83 → 150** — batch 3 +27 (`application.*`5 `charge.*`6 `payment.*`5 `expense.*`5 `adjustment.*`4 `statement.read` `receipt.issue`), batch 4 +19 (`maintenance.*`5 `work_order.*`6 `inspection.*`4 `schedule.*`4), batch 5 +21 (`listing.*`6 `lead.*`5 `viewing.*`4 `offer.*`5 `handoff.create`); `PermissionAction.ISSUE` + `ResourceType` += APPLICATION/CHARGE/PAYMENT/EXPENSE/ADJUSTMENT/STATEMENT/RECEIPT/MAINTENANCE/WORK_ORDER/INSPECTION/SCHEDULE/LISTING/LEAD/VIEWING/OFFER/HANDOFF. (No DEAL resource — deal pages gate on `offer.read`.)
- **Role enrichment** (research-property-1 §2, all four kinds): LANDLORD/PM/MM `owner` each get **all 105 domain keys** (136 total — identical sets, matrix guard enforces) · LANDLORD manager +73 domain · PM prop_mgr (ledger create/post subset, full ops, listing/lead ops-side) · finance_officer (ledger submit set, no approves) · finance_approver (approve-only: charge/expense/adjustment approve, **no create** — separation of duties enforced by keys) · leasing_officer (+application full, lead/listing/viewing capture) · caretaker (+maintenance edit, work_order update, inspection full) · maintenance_coordinator (+work_order assign, schedule) · MM coordinator (full ops incl. work_order.assign) · technician (work_order update + inspection) · MK owner/agent/viewer get sales keys only (listing/lead/viewing/offers + handoff.create for agent) — **no** tenancy/finance/ops keys.
- **Verified**: `prisma validate` ✓ · `db push` ✓ (one fix en route: `Inspection.inspectorUserId` needed `@db.Uuid` to match `User.id`) · `generate` ✓ · matrix-guard test ✓ · `db:seed` → 150 permissions, live spot-check example-org LANDLORD (owner 136 total/105 domain, manager 86/73, viewer 32/27; owner holds all sample batch-3/4/5 keys incl. `charge.approve`/`adjustment.approve`/`handoff.create`; finance_approver separation verified in template) ✓ · `tsc -p packages/database` ✓ · `pnpm typecheck` 9/9 ✓ · `pnpm lint` 9/9 (0 errors) ✓. E2E smokes not re-run — additive schema/seeds only. **DB layer for Phase 2 is complete**; next is API routes, then pages (incl. tenant-portal API/UI, still unbuilt).

### Security & authorization hardening — all committed, all smoked
| Batch | Commit | Verified |
| --- | --- | --- |
| `apiRoute` — single permission-checked route constructor | `2b2675b` (+ `37ca9c8` `7c29efc` `ba2ddda` `5a3cb92` cleanup) | apiroute E2E 14/14 |
| Crypto session tokens + sliding renewal | `6a928b0` | security E2E (expiry slide ✓) |
| Rate limiting on all auth endpoints | `85faf61` | security E2E (11th → 429 + Retry-After) |
| Immediate permission-cache invalidation + sibling-session revocation | `9602c1e` | security E2E (perms 5→0 instantly; sibling dead) |
| Versioned Terms/Privacy consent (DB model + enforcement) | `30ed037` `24015d1` `00138b4` `5950bf9` | consent E2E 8/8 sections |

### Verification status (last run 19:00, 2026-10-19)
- `pnpm --filter web typecheck` + `lint` → 0 errors / **3 warnings** (baseline) ✓
- `pnpm --filter sisohome-admin typecheck` + `lint` → 0 errors / 3 warnings ✓
- `pnpm --filter @workspace/auth-ui` typecheck+lint → 0/5 baseline ✓ · `@workspace/email` clean ✓ · `npx tsc -p packages/database` ✓ · `packages/ui` 0/48 baseline ✓
- All 6 E2E smokes passed **against the recovered scripts** (19:00, run with `BASE=http://localhost:3001` since web fell back — see blocker #1/#2): **consent 8/8, verify 10/10, 2FA 11/11, email 12/12, apiroute 14/14, security 5/5**. DB residue after runs: 0 smoke users · 0 smoke orgs · 0 consent rows

## 4. Operating playbook

**Dev server** (one `next dev` per app dir; only one instance survives; log to a file):
```bash
cd apps/web && (setsid pnpm dev > /tmp/opencode/dev-server.log 2>&1 &) ; sleep 14
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login   # expect 200
```
⚠ Next silently falls back to another port if busy — always check the log for `Port 3000 is in use`. Never `pkill -f "next dev"` while your own shell command contains that string (it matches itself); kill by PID.

**Verify before commit:** the typecheck/lint commands above. Never `pnpm build`.

**Database** (live remote Prisma Postgres):
```bash
cd packages/database && set -a && source .env && set +a
npx prisma db push        # repo convention (no migration SQL)
npx prisma generate       # db push does NOT regenerate — do both; then restart dev servers
npx tsx src/seed/seed-data.ts   # = pnpm db:seed — idempotent; re-running re-upserts the
                                # permission catalog AND re-enriches kind template roles
                                # with new domain keys (skipDuplicates; owner edits kept)
```
Smoke runs must leave zero smoke users/orgs/consent rows; helper `src/seed/__smoke-db.ts` (cascades user but NOT org — delete orgs by name separately).

**Rate limits** are in-process memory → reset on dev-server restart; 6 smokes fit within them by design.

**Email** in dev = outbox (`EMAIL_TRANSPORT=outbox`), cwd-relative `.email-outbox/` → each app writes its own dir; mail templates are rendered in-app under `apps/<app>/lib/email/`.

**E2E smokes** live in-repo at `packages/database/smoke/` (6 scripts; recovered 2026-10-19 — see §5.1):
```bash
BASE=http://localhost:3000 bash packages/database/smoke/smoke-<name>-e2e.sh   # names: consent, verify, 2fa, email, apiroute, security
```
They self-clean users+orgs, read the dev outbox, and fit within rate limits; run them one at a time. `BASE` is honored everywhere (verify/email page-fetches follow mail links on `$BASE`).

**Code search** — semantic index via `ccc` (skill `.agents/skills/ccc`, installed 2026-10-19 with `uv tool install 'cocoindex-code[full]'`): `ccc search "<concept>"`; after significant code changes run `ccc index` (settings in `.cocoindex_code/`, gitignored; 627 files / 4897 chunks indexed).

**Scripts:** `apps/web/scripts/__smoke-token.ts` (TOTP/OTP helper), `packages/database/src/seed/__smoke-db.ts` (session-expiry/set-session-expiry/consents), `packages/database/src/seed/__smoke-del-user.ts` (cascade delete one smoke user; orgs must be deleted separately).

## 5. Open items & blockers

1. ~~**E2E smoke scripts lost**~~ **RESOLVED 19:00, 2026-10-19.** `/tmp/opencode` had been wiped; all six scripts were reconstructed verbatim by replaying every `write`/`edit`/bash-patch from opencode's session DB (`opencode.db` → `part.data`, strict chronological replay — the apiroute 20:21 `sed` was a no-op in the original too, so it was omitted) and committed to **`packages/database/smoke/`**. All 6 re-passed end-to-end afterwards. Two one-line portability patches added (`PAGE_URL` host rewrite in verify + email so page-fetches honor `BASE`; identical behavior on :3000). **Lesson: never store durable work in `/tmp`.**
2. **Port 3000 conflict.** The user's `tijwa-invoice-app` (PID 85579, started 11:37) still holds 3000 at 19:03; `web` fell back to 3001 (PID 186179); `sisohome-admin` is *configured* for 3001 → collision pending. Plan: user stops invoice-app → restart `web` on 3000 → admin keeps 3001. Smokes default to `localhost:3000` (override with `BASE=`).
3. **Accepted security leftovers** (audited, not approved for fixing): `admin` template role lacks `role.manage`; dead `PolicyEngine`; no auth-event audit trail; no org-enforceable MFA; plaintext temp passwords; consent gate for pre-existing users deferred to next password change (approved).
4. **`FOUNDATION_SUMMARY.md` staleness** — claims "no business-specific seed data" (now 4 kind templates) and unwired `protectRoute` (use `apiRoute`/`requireAuth`). Not yet edited.
5. **`db.md` empty**; `README.md` still upstream template boilerplate.
6. **Known kind work**: `OrganizationKind` = LANDLORD, PROPERTY_MANAGEMENT, MAINTENANCE_COMPANY, MARKETING_AGENT; templates in `src/seed/org-kind-templates.ts`; **150** permission keys in `src/seed/foundation-permissions.ts` (45 foundation + 26 property batch 1 + 12 tenancy batch 2 + 27 ledger batch 3 + 19 ops batch 4 + 21 sales batch 5 — **all 5 Phase-2 DB batches complete**); extension steps documented in `ADOPTION.md` §2. Tenant-portal **API/UI** (invite accept flow, portal guard, tenant-scoped actor) is schema-ready but not built. **Next: API routes for the property domain, then pages.**

## 6. Recent commits (tip of `main`)

```text
40ccd27 docs: STATUS.md living state doc + AGENTS.md pointer
777c74b chore: add sisohome-admin app as cross-vertical template
9749ad0 docs: foundation adoption guide for other verticals
5950bf9 chore(database): smoke helper inspects consent rows
00138b4 feat(web): enforce versioned Terms/Privacy consent
24015d1 feat(auth-ui): consent state plumbing
30ed037 feat(database): versioned user-consent model
542bee5 chore: smoke helpers — TOTP token generator + session DB inspector
9602c1e fix: immediate permission-cache invalidation + sibling session revocation
85faf61 feat(web): rate limiting on auth endpoints
6a928b0 fix(database): crypto-strong session tokens + sliding renewal
2b2675b feat(web): apiRoute — single permission-checked route constructor
```
