# Slice 1 — Portfolio (property, units/buildings, ownership, assignment, documents, activity)

Reference slice: establishes the shared-form pattern and the scope rules in practice. DB models already exist (batch 1) — this is API + UI only.

---

## 1. Who creates & handles property (decision 1 — enforced by route permissions, not kind checks)

| Org kind | Roles with `property.create` | Resulting `portfolioOrganizationId` | Notes |
| --- | --- | --- | --- |
| LANDLORD | `owner`, `manager` | **own org** | primary creator |
| PROPERTY_MANAGEMENT | `owner`, `property_manager` | **own org** | PM may hold its own assets (office, staff housing) — a PM-created property is the PM's portfolio; managing *others'* property is via agreements (§3) |
| MAINTENANCE_COMPANY | `owner` only | **own org** | coordinator/admin/viewer are read-only (matrix) |
| MARKETING_AGENT | nobody (owner has `property.read/list` only) | — | MK reads shared listing **projections**, never the full Property row |

Handling (edit/archive) = `property.update`/`property.archive`: LANDLORD manager · PM prop_mgr · owners of every kind (identical owner sets). The **portfolio org's** users always pass `propertyScopeWhere` (arm 1); PM/MM users additionally pass via agreement/staff/job arms.

**Create rule**: `POST /api/properties` sets `portfolioOrganizationId = actor.organizationId` — period. You never create property *for* another org; giving a PM/MM org access is an **assignment** (§3).

---

## 2. Property assignment — the complete model

### 2.1 The two modes

| Mode | Mechanism | Who acts | Actor's reach afterwards |
| --- | --- | --- | --- |
| **A. Own portfolio** | create property (§1) | LANDLORD/PM/MM owner-side roles | full — `portfolioOrganizationId` arm |
| **B. Managed for others** | `PropertyManagementAgreement` row | created by *either* side, **approved by owner-side** | PM/MM get whole-property ops **only while ACTIVE** (dates enforced) |

Three narrower links layer on top of B (they never replace it):

| Link | Row | Grants | Typical use |
| --- | --- | --- | --- |
| Staff assignment | `PropertyStaffAssignment(userId, propertyId, isActive, dates)` | row-scope for **assigned users** (arm 3) — caretaker, site staff, PM staff of any org | individual people, not orgs |
| Per-job link | `WorkOrderAssignment(assigneeOrganizationId)` | MM org reaches that property **because a job is assigned** (arm 4) — see slice 3 | ad-hoc maintenance contracts |
| Listing share | `Listing.marketingOrganizationId` | MK org reads **listing projection only** (never full Property) — see slice 5 | marketing agents |

### 2.2 Management agreement lifecycle (API + UI)

Schema (batch 1): `PropertyManagementAgreement { id, organizationId (= portfolio org of the property), propertyId, managementOrganizationId, ownerPartyId, status DRAFT→ACTIVE→…, startsAt, endsAt?, scope? Json, timestamps }` + `@@index([managementOrganizationId, status])`. Contract file = `PropertyDocument(entityType=AGREEMENT)`.

```
DRAFT ──(either side: agreement.create on its own property/for itself)──▶
DRAFT ──(owner-side: agreement.approve)──▶ ACTIVE ──▶ SUSPENDED/ENDED/TERMINATED
```

- **Row always lives in the portfolio org** (`organizationId` = property's portfolio org) — child-row rule. So:
  - Owner-side creates: `POST /api/properties/[propertyId]/agreements` with `managementOrganizationId` + `ownerPartyId`.
  - PM/MM-side proposes: `POST /api/agreements` with `propertyId` → server first `assertPropertyInScope(actor, propertyId)` (PM must already hold the property? **No** — a proposal by an org with no relationship must be visible to the portfolio org as DRAFT. Resolution: allow create when `propertyId`'s portfolio org ≠ actor AND actor holds `agreement.create` — the DRAFT sits in the portfolio org and appears in *that org's* agreement inbox as "proposed by X"; portfolio org approves or ignores. PM's own list shows rows where `managementOrganizationId = actor.organizationId`.) — **rule: create allowed from either side; only portfolio-org actors with `agreement.approve` flip to ACTIVE.**
- Both orgs must match relationships on every read:
  ```ts
  where: { OR: [ { organizationId: actor.organizationId },       // portfolio side
                  { managementOrganizationId: actor.organizationId } ] }  // manager side
  ```
- Approval flips status + `startsAt ≤ now ≤ endsAt` opens scope arm 2 **immediately** — smoke must prove: PM sees 0 properties → approve → sees 1.

### 2.3 Staff assignment (row-scope for people)

`POST /api/properties/[propertyId]/staff` (`property.update` on portfolio side? → **decision**: ride `relationship.create`/`relationship.revoke` per batch-1 schema comment — no new key family; UI gates on `property.update`). Rows: `userId`, `title`, `startsAt`, `endsAt?`, `isActive`. Revocation = `isActive=false` (never hard delete — history). Queries for assigned roles (`caretaker`) hit `staffAssignments.some({userId: actor.userId, …})` — already arm 3.

### 2.4 MM without agreement = job-scoped only

MM org with **no** agreement sees properties only insofar as they have assigned work orders (arm 4). Their property list therefore contains exactly those properties; full ops keys apply there (identical-owner invariant), row-level permission ∧ relationship holds. Slice 3 smokes the MM assignment → visibility flip.

---

## 3. API routes (all under `apps/web/app/api/`, services in `lib/domain/{property,unit,ownership,documents}.ts`)

### 3.1 Properties

| Method & path | Permission | Scoping / rules |
| --- | --- | --- |
| `GET /api/properties` | `property.list` | `findMany({ where: { ...propertyScopeWhere, status?, category? }, include: counts })`; MK never calls this |
| `POST /api/properties` | `property.create` | `portfolioOrganizationId = actor.organizationId`; validate category/propertyType, lat/lng ranges, reject (0,0); `status=DRAFT` unless `activate=true` |
| `GET /api/properties/[id]` | `property.read` | scope + include (buildings count, units count, ownerships, agreements **only where actor org matches either side**) |
| `PATCH /api/properties/[id]` | `property.update` | fetch → `assertPropertyInScope` → `updateMany({where:{id, portfolioOrganizationId: <owner>}})`; allowlist fields (never `id/portfolioOrganizationId`) |
| `DELETE /api/properties/[id]` | `property.delete` | **drafts only**: `status=DRAFT` AND no units/leases/agreements → hard delete; else `RouteError(409)` |
| `POST /api/properties/[id]/archive` | `property.archive` | `status → ARCHIVED`; un-archive = `POST …/unarchive` (`property.update`) |
| `GET /api/properties/[id]/activity` | `audit.read` | `AuditLog.where({ organizationId: actor.organizationId, resourceId: id })` (portfolio org only — managed orgs read property detail, not the landlord's audit trail) |

### 3.2 Buildings, unit types, units (full unit management)

| Method & path | Permission | Scoping / rules |
| --- | --- | --- |
| `GET/POST /api/properties/[id]/buildings` | `unit.list` / `unit.create` | assert property scope; `organizationId` = portfolio org; `@@unique([propertyId, code])` → 409 on dup |
| `PATCH/DELETE /api/buildings/[id]` | `unit.update` / `unit.delete` | fetch → parent scope → `updateMany`; delete blocked while units attached (409) |
| `GET/POST /api/unit-types` | `unit.read`/`unit.create` | flat org scope `organizationId = actor.organizationId` (org-level catalog, no property parent) |
| `PATCH/DELETE /api/unit-types/[id]` | `unit.update` / `unit.delete` | `updateMany({ id, organizationId: actor.organizationId })` |
| `GET /api/properties/[id]/units` | `unit.list` | scope through parent; include `building`, active-lease occupancy (`units` where `leases.some(active-on-today)` → derived field `occupancy`, never stored) |
| `POST /api/properties/[id]/units` | `unit.create` | `organizationId` = portfolio org; validate `unitRef` unique per property (409); defaults from body |
| `POST /api/properties/[id]/units/bulk` | `unit.create` | `{ unitTypeTemplateId? , prefix, from, to, skip?, buildingId?, defaults }` → range generator ("units 101–124"), pre-validate ALL refs for uniqueness (all-or-nothing), `createMany` |
| `GET/PATCH/DELETE /api/units/[id]` | `unit.read`/`unit.update`/`unit.delete` | fetch → parent scope; delete blocked by any `LeaseUnit`/`Charge` (409); **never** touch `status` manually except admin flag `MAINTENANCE/BLOCKED` (documented: `status` cache is recomputed on lease transitions by slice 2) |

Unit fields are **templates** — API docs on the routes must say: changing `defaultRent` never rewrites live leases/charges (property.md §2).

### 3.3 Ownership, agreements, staff (assignment surfaces)

| Method & path | Permission | Scoping / rules |
| --- | --- | --- |
| `GET/POST /api/owner-parties` | `ownership.read` / `ownership.create` | flat org scope; `linkedOrganizationId/linkedUserId` allowed (owner portal later) |
| `PATCH/DELETE /api/owner-parties/[id]` | `ownership.update` | flat org `updateMany`; delete blocked while ownerships/agreements reference (409) |
| `GET/POST /api/properties/[id]/ownerships` | `ownership.read`/`ownership.create` | assert scope; **XOR**: exactly one of `propertyId`/`unitId` (property-level here; unit-level = `POST /api/units/[id]/ownership`) → 400 otherwise; `sharePercent` sum ≤ 100 warn (server allows >100? **no — 400** on sum > 100 across active rows) |
| `PATCH /api/ownerships/[id]` | `ownership.update` | fetch → parent scope → update; date-window edits only |
| `DELETE /api/ownerships/[id]` | `ownership.update` | `endsAt = now`-style soft close preferred; hard delete only if no audit consumers — **decision: hard delete allowed (ownership rows are approvals-in-motion), audit keeps history** |
| `GET /api/agreements` | `agreement.list` | either-side OR (§2.2) |
| `POST /api/agreements` | `agreement.create` | see §2.2 dual-entry rule; default `status=DRAFT` |
| `PATCH /api/agreements/[id]` | `agreement.update` | either side, **pre-approve only** (once ACTIVE only portfolio org may edit dates/scope; manager may `POST /api/agreements/[id]/end` with `agreement.update` → status ENDED on their side — **decision: symmetric end = manager or owner may end; only owner approves**) |
| `POST /api/agreements/[id]/approve` | `agreement.approve` | portfolio org only; DRAFT→ACTIVE; sets/validates `startsAt` |
| `GET/POST/DELETE /api/properties/[id]/staff` | `property.update` (+ UI gate) | portfolio scope for list/create; delete = `isActive=false`; `POST /api/staff-assignments/[id]/revoke` symmetric |

### 3.4 Documents (polymorphic — reused by every later slice)

| Method & path | Permission | Scoping / rules |
| --- | --- | --- |
| `GET /api/documents?entityType=&entityId=` | `document.read` | resolve entity → its property → `assertPropertyInScope`; `entityType=PROPERTY/UNIT/OWNERSHIP/AGREEMENT/OWNER_PARTY` in this slice |
| `POST /api/documents` (multipart or JSON w/ storageKey) | `document.upload` | body `{ entityType, entityId, kind, caption?, isCover?, sortOrder? }` → same resolution; `organizationId` = portfolio org (flat for OWNER_PARTY) |
| `DELETE /api/documents/[id]` | `document.delete` | scope → hard delete row (+ storage object later — storage adapter is out of wave, store `storageKey` only) |
| `POST /api/documents/[id]/versions` | `document.upload` | `DocumentVersion` append; never mutate prior versions |
| Gallery ops | `document.update` | `isCover`/`caption`/`sortOrder` patch — single winner for `isCover` per (entity, kind=PHOTO) (transaction) |

**Storage**: this wave stores metadata + `storageKey` (upload bytes can be stubbed: accept a key/URL input field first; real object storage is a separate infra decision — flagged as open item).

---

## 4. UI pages

### 4.1 Routes

| Route | Purpose | Gate | Form sharing |
| --- | --- | --- | --- |
| `/portfolio` | index: search + filters (category, status, type), grid/list toggle; map toggle deferred to open choice; primary **Add property** | `property.list` / `property.create` | — |
| `/portfolio/new` | create page → `<PropertyForm mode="create" variant="wizard">` | `property.create` | **shared** |
| `/portfolio/[propertyId]` | detail shell + tabs (§4.2) | `property.read` | — |
| `/portfolio/[propertyId]/edit` | edit page → `<PropertyForm mode="edit" initialValues={fetched}>` | `property.update` | **shared** |
| `/portfolio/[propertyId]/units` | buildings + units manager (§4.3) | `unit.list` | — |
| `/portfolio/[propertyId]/units/new` | `<UnitForm mode="create">` | `unit.create` | **shared** |
| `/portfolio/[propertyId]/units/[unitId]/edit` | `<UnitForm mode="edit">` | `unit.update` | **shared** |
| `/portfolio/[propertyId]/documents` | gallery + doc list per kind | `document.read` | — |
| `/portfolio/[propertyId]/activity` | audit trail | `audit.read` | — |
| `/portfolio/owners` | owner-party directory | `ownership.list` | — |
| `/portfolio/owners/new` | `<OwnerPartyForm mode="create">` | `ownership.create` | **shared** |
| `/portfolio/owners/[ownerId]` | party detail: contact, ownerships, statements link | `ownership.read` | — |
| `/portfolio/owners/[ownerId]/edit` | `<OwnerPartyForm mode="edit">` | `ownership.update` | **shared** |
| `/portfolio/owners/agreements` | agreements list (either-side rows), status filter, **inbox for proposals** | `agreement.list` | — |
| `/portfolio/owners/agreements/new` | `<AgreementForm mode="create">` (property picker + manager picker + owner party + dates) | `agreement.create` | **shared** |
| `/portfolio/owners/agreements/[id]/edit` | `<AgreementForm mode="edit">` + Approve button (owner-side only, `hasUiPermission('agreement.approve')` + row `status=DRAFT` + actor org = portfolio) | `agreement.update` | **shared** |

Detail-tab **staff management** lives in `…/staff` tab with dialog-based `StaffAssignmentForm` (create only + revoke — no edit page needed for assignment rows).

### 4.2 Property detail tabs (`?tab=` deep-linking)

| Tab | Content | Data |
| --- | --- | --- |
| Overview | status chip, category/type, address + map card (derived Maps links via `lib/maps.ts` helpers — create in this slice: `mapsPinUrl/DirectionsUrl/SatelliteUrl`), amenities/utilities chips, defaults summary (deposit months, frequencies), KPI mini-cards (units, occupancy, active leases — deferred numbers to slices 2/4 render `—` until available) | GET property |
| Units | embedded summary + link to `/units` manager (full manager is its own page) | counts |
| Media & Documents | upload + gallery (isCover) + per-kind list | documents API |
| Ownership | ownership rows (whole-property here; unit-level rows listed with unit links), `sharePercent` bars | ownerships |
| Management | agreements where actor matches either side; **Assign manager** button (`agreement.create`); staff assignment rows + **Assign staff** | agreements + staff |
| Activity | audit list | activity API |

### 4.3 Unit manager page (full unit management — `/portfolio/[id]/units`)

Layout: header with **Add unit** + **Bulk add** (gated `unit.create`), building filter chips (from buildings list + "Unassigned"), status chips (VACANT/OCCUPIED/RESERVED/MAINTENANCE/BLOCKED — server-provided where available), search over `unitRef/label`.

Sections:
1. **Buildings panel**: list (code, floors, unit count) + `BuildingForm` dialog (create/edit — dialog OK, not a route: buildings are lightweight; primary entities get routes per pattern).
2. **Units table** (`ResponsiveDataListing` + `ColumnDef`): unitRef, label, kind, floor/beds, area, default rent, **derived occupancy** (Occupied from active lease, else status), actions: edit (`unit.update`), documents, delete (`unit.delete`, 409-aware).
3. **Bulk add dialog**: template select (`unit-types`) or manual defaults → prefix + range from/to + building + skip list → live preview of generated refs (e.g. `A-101…A-124`) → POST `/units/bulk`; pre-flight 409 reports the exact conflicting refs.
4. **Unit detail** = edit page with a read-only occupancy/lease strip ("Occupied until X by lease LSE-…") — live lease data comes from slice 2 (renders placeholder until then).

### 4.4 Property wizard / form (`property-form.tsx` — the reference shared form)

`variant="wizard"`, identical tree for create + edit, steps:

1. **Identity**: name, `code` (helper: human ref, optional), category (select), propertyType (select filtered by category), status (edit mode only), tags
2. **Location**: addressLine1/2, locality, region, postalCode, country (default KE), pin: lat/lng inputs + "Open in Maps" paste-parsing + optional OSM pin-drop (open choice — **ship lat/lng manual + paste-parse first**, interactive map behind open choice), `directionsNote`, landmark
3. **Structure**: floors, parking, area fields, amenities (multi-select chips), utilities chips
4. **Legal** (category=LAND required before listing): titleType, titleNumber, registryReference, surveyPlanNumber, landControlArea, zoning, rateClearanceStatus/ExpiresAt, encumbrances
5. **Defaults & media**: currency (default KES), defaults JSON-lite fields (rent frequency, deposit months, late-fee, notice days, service-charge rate), virtualTourUrl/videoUrl; media upload deferred to detail page Documents tab (wizard step 5 = defaults only — **media lives on the detail tab** to keep edit/create parity simple)

Validation: required per category (LAND requires pin + title number before **publish** — property.status ACTIVE check server-side on un-draft; simple client validation now), lat/lng range + reject (0,0), date sanity (rateClearanceExpiresAt future).

---

## 5. Sequencing inside the slice

1. `lib/domain/{property-scope,audit}.ts` if not already from slice 0 → property service + `/api/properties` routes
2. `PropertyForm` + `/portfolio` + `/portfolio/new` + `/portfolio/[id]` (Overview/Activity tabs)
3. Buildings/units/unit-types services + routes + unit manager page + `UnitForm` + bulk dialog
4. Owner parties + ownerships (+ unit-level ownership endpoint) + Owners pages
5. Agreements (dual-entry + approve) + Management tab + agreements pages
6. Staff assignment + documents + Media/Documents tab
7. Smoke + verify (§6)

## 6. Acceptance & smoke

- [ ] Matrix test · typecheck 9/9 · lint 9/9
- [ ] API smoke script (`packages/database/smoke/smoke-property-e2e.sh` — follow existing smoke conventions):
  - landlord creates property → PM org `GET /api/properties` **[]** → owner creates agreement DRAFT → PM approves? (no: PM lacks `agreement.approve` → 403) → owner approves → PM list = 1, `GET /api/properties/[id]` 200, PATCH 200
  - MM org with no agreement + no jobs: list `[]`; property PATCH as MM → 404
  - staff assignment: PM staff user (assigned) sees property; unassigned PM staff sees `[]`
  - unit create duplicate `unitRef` → 409; bulk with conflict → 409 listing refs; delete property with units → 409; draft delete → 200
  - MK org: `GET /api/properties` → 403 (no `property.list`? MK owner HAS property.list via catalog — **guard**: MK sessions must be rejected by the MK projection rule; resolution: `GET /api/properties` handler additionally returns only `propertyScopeWhere` rows — MK scope arm 5 doesn't exist so they get `[]`; full Property JSON is never shaped for MK. Listing endpoints are slice 5. Accept `[]` as correct.) 
- [ ] Manual UI pass: create → detail → units bulk → assign manager → approve → PM view; 403 buttons hidden for viewer role

## 7. Notes / deferred

- Map pin interactive picker (open choice), static-tile preview
- Real object storage for uploads (metadata-only now)
- `PropertyAgentAssignment` — slice 5 (listing batch)
- Derived KPI numbers depend on slices 2/4 (placeholders until then)
