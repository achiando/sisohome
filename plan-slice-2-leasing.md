# Slice 2 — Leasing (tenants, applications, leases + portal invite)

DB models exist (batch 2: `Tenant`, `TenantPortalInvite`, `Lease`, `LeaseUnit`, `LeaseTenant`, `RentalApplication` from batch 3). Child-row rule: `organizationId` = property's portfolio org; **scope everything through the parent property** (§B of index) except tenant party rows which scope **flat** (`Tenant.organizationId = actor.organizationId`? — **no**: tenants belong to the leasing org which may be the portfolio org OR a PM org acting under agreement. Resolution below).

## 1. Tenancy scoping decision (read first)

- `Tenant.organizationId` = the org that **created the tenant party** (capturing org — leasing org). Tenants are reachable in two ways:
  1. **flat**: `organizationId = actor.organizationId` (you created them; PII stays yours), or
  2. **through leases**: tenant has `LeaseTenant` rows whose `lease.property` passes `propertyScopeWhere` (a landlord viewing a tenant already linked to their property).
- Composition for list: `where: { OR: [ {organizationId: actor.organizationId}, { leases: { some: { lease: { property: propertyScopeWhere(actor) } } } } ] }`.
- **Create**: `organizationId = actor.organizationId` (leasing org captures) — NOT the portfolio org. Tenants are party records, not property children. Applications/charges reference them safely (charge rows still carry portfolio org via property).
- PII gate: every tenant read requires `tenant.read`; responses never cached client-side across sessions; `notes` never exposed to portal (slice 7).

`Lease` / `ChargeSchedule` / `LeaseUnit` / `LeaseTenant` / `RentalApplication` ARE property children → `property: propertyScopeWhere(actor)` + `organizationId` inherits portfolio org (except applications created by a leasing org? **rule: property children always inherit portfolio org** — a PM org under agreement creates a lease; lease.organizationId = portfolio org; the PM reaches it back through the parent scope. Holds.)

## 2. API routes

### 2.1 Tenants (`lib/domain/tenant.ts`)

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/tenants` | `tenant.list` | OR-scope above; filters: status, q (name/phone/email); phone last-4 masking unless `tenant.read` (list shows minimal columns anyway) |
| `POST /api/tenants` | `tenant.create` | `organizationId = actor.organizationId`; unique `[org, email]`, `[org, tenantRef]` → 409; status PROSPECT/ACTIVE per input |
| `GET /api/tenants/[id]` | `tenant.read` | OR-scope; include leases (+units), applications, documents, portal state |
| `PATCH /api/tenants/[id]` | `tenant.update` | fetch within OR-scope → `updateMany({id, organizationId: own})` |
| `DELETE /api/tenants/[id]` | `tenant.delete` | blocked (409) if any `LeaseTenant` exists (schema Restrict anyway) |
| `POST /api/tenants/[id]/portal-invite` | `tenant.manage` | create `TenantPortalInvite` (hashed token, expiry), flip `portalStatus=INVITED`, `portalInvitedAt`; **this slice only creates the invite + logs the link** (email dispatch pattern = outbox mail; sending can reuse existing email helpers — decide at build; acceptance flow is slice 7). Re-invite allowed while not ACTIVE; rate-limit by existing auth rate-limiter |

### 2.2 Applications (`lib/domain/application.ts`)

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/applications` | `application.list` | `property: propertyScopeWhere`; filters status/property |
| `POST /api/applications` | `application.create` | from applicant form (tenant created if needed in same call? **separate calls, UI does two-step**); validates property in scope; status SUBMITTED |
| `GET /api/applications/[id]` | `application.read` | scope; include applicant tenant (PII → needs `tenant.read` too? **decision: application detail includes tenant PII only when caller holds `tenant.read`**, else contact-minimal) |
| `PATCH /api/applications/[id]` | `application.update` | notes/incomeVerified/unitId pre-decision; **fields editable only before decidedAt** → 409 after |
| `POST /api/applications/[id]/decision` | `application.approve` | body `{decision: 'APPROVED'|'REJECTED', leaseId?}`; sets `decidedAt`, `decidedByUserId=actor.userId`; approve may **pre-create lease** later (UI: "Approve & start lease" navigates to lease wizard prefilled — lease create still `lease.create`) |
| documents | `document.upload/read` | screening docs via polymorphic documents (`entityType=APPLICATION`) |

### 2.3 Leases (`lib/domain/lease.ts`) — the strictest logic in the wave

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/leases` | `lease.list` | `property: scope`; filters status, expiring-in-N-days, propertyId |
| `POST /api/leases` | `lease.create` | validate: ≥1 unit of ONE property (cross-property units → 400), ≥1 party (PRIMARY), dates sane (`endsAt > startsAt` or null), **serializable overlap check**: transaction — `SELECT` existing ACTIVE/SCHEDULED/ENDING leases' LeaseUnits for same unitIds with range overlap → 409 listing overlaps (schema comment: API-layer rule, Prisma can't partial-unique); `organizationId` = portfolio org; status DRAFT or PENDING_APPROVAL per input |
| `GET /api/leases/[id]` | `lease.read` | scope; include units+terms, parties (tenant PII iff `tenant.read`), documents, renewal chain, charges (from slice 4 — placeholder) |
| `PATCH /api/leases/[id]` | `lease.update` | draft/active amendment; unit set change re-runs overlap check for added units; status transitions guarded: DRAFT→PENDING_APPROVAL etc. (allowed-transitions map in service; illegal → 409) |
| `POST /api/leases/[id]/approve` | `lease.approve` | PENDING_APPROVAL→SCHEDULED/ACTIVE (if `startsAt ≤ today`); sets `signedAt` if provided; **recomputes `Unit.status = OCCUPIED` for all LeaseUnits** (the documented cache) |
| `POST /api/leases/[id]/renew` | `lease.manage` | creates NEW lease (`renewalOfId = old.id`) with copied units/parties + new dates → returns `{lease}` (redirect to its detail); old lease → ENDING/TERMINATED per input |
| `POST /api/leases/[id]/terminate` | `lease.manage` | status→TERMINATED, `noticeDate`, `endsAt=today` if requested; recomputes unit status (vacate → VACANT only if no other active lease) |
| `POST /api/leases/[id]/close` | `lease.manage` | →CLOSED when no outstanding balance? (balance = derived from charges — slice 4: **check `charge` balance = 0 via service call when slice 4 lands; until then allow close**) |
| `POST /api/leases/[id]/cancel` | `lease.update` | DRAFT/PENDING→CANCELLED |
| unit-status recompute | internal | helper `recomputeUnitStatus(unitIds)` in `lib/domain/unit.ts` — call on approve/terminate/close; VACANT/OCCUPIED only (manual MAINTENANCE/BLOCKED flag preserved) |

## 3. UI pages

| Route | Purpose | Gate | Form |
| --- | --- | --- | --- |
| `/leasing` | dashboard: pipeline cards (draft → pending approval → scheduled → active), **expiring in 30d** list, arrears shortcut (slice 4 data; placeholder now), quick actions | `lease.list` | — |
| `/leasing/tenants` | directory: search + status filter, minimal columns (name, phone, status, active lease) | `tenant.list` | — |
| `/leasing/tenants/new` | `<TenantForm mode="create">` (wizard: identity → contact → employment → guarantor) | `tenant.create` | **shared** |
| `/leasing/tenants/[id]` | profile tabs: Overview (contact, guarantors, portal status + **Invite to portal** button), Leases, Applications, Documents, Notes (internal) | `tenant.read` | — |
| `/leasing/tenants/[id]/edit` | `<TenantForm mode="edit">` | `tenant.update` | **shared** |
| `/leasing/applications` | queue grouped by status (submitted/screening/decision), property filter | `application.list` | — |
| `/leasing/applications/[id]` | review: applicant + income flags + documents upload + notes; actions **Approve/Reject** (dialog) with optional "start lease" | `application.read` / `.approve` | — |
| `/leasing/applications/new` | `<ApplicationForm mode="create">` (property + unit + tenant picker or inline-create) | `application.create` | **shared** |
| `/leasing/applications/[id]/edit` | `<ApplicationForm mode="edit">` (pre-decision only) | `application.update` | **shared** |
| `/leasing/leases` | register: status filter, expiry column with color chips, rent column, party count | `lease.list` | — |
| `/leasing/leases/new` | `<LeaseForm mode="create">` wizard: parties (PRIMARY + joint/guarantor rows) → units (single property enforced, per-unit rent/deposit defaults pre-filled from Unit) → dates/frequency/due day/deposit → terms → review & save (→ PENDING_APPROVAL) | `lease.create` | **shared** |
| `/leasing/leases/[id]` | detail tabs: Terms (editable via edit page), Units & parties, Documents (upload agreement), Timeline (renewal chain, status transitions with action buttons gated: approve/renew/terminate/close/cancel), Charges (slice 4) | `lease.read` | — |
| `/leasing/leases/[id]/edit` | `<LeaseForm mode="edit">` | `lease.update` | **shared** |

Portal invite UI: on tenant profile — button gated `tenant.manage`; dialog shows invite link once + "copy"; status badge NOT_INVITED/INVITED/ACTIVE/SUSPENDED. (Acceptance flow = slice 7.)

## 4. Sequencing

1. tenants service/routes + pages (incl. invite-create)
2. applications
3. leases service (overlap transaction + transitions + unit-status recompute) + pages
4. smoke

## 5. Acceptance & smoke

- [ ] typecheck/lint/matrix green
- [ ] Smoke: create property+unit (slice 1 data) → tenant → application → approve → lease create → overlap: second lease same unit+range → 409 → approve lease → `Unit.status=OCCUPIED` → terminate → VACANT; wrong-org lease GET → 404; tenant invite created (token hash exists, `portalStatus=INVITED`)
- [ ] UI: wizard create/edit parity (same `lease-form.tsx`); PII negative = **MM viewer session** (holds zero tenancy keys) → `GET /api/tenants` 403
