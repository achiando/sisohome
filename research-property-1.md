# research-property-1.md — Property phase: permissions, roles & pages (source of truth)

Part of the numbered research series for the property domain (`property.md` owns design decisions; this series owns researched facts).

| Doc | Owns |
| --- | --- |
| **research-property-1.md (this)** | Domain permission catalog, role→permission assignments per org kind, enforcement model, full page/nav inventory |
| research-property-2.md | Property/Unit data model (all fields), Google Maps pin & address, platform field parity (Zillow, BuyRentKenya) |
| research-property-3.md | Property-type taxonomy (incl. malls, land, multi-owner apartments), ownership models, tenant management |
| research-property-4.md | Property sale workflow (incl. land), marketing-agent handoff, deal pages |

Grounded in: `AGENTS.md`, `BUILD.md` (Phase 2 scope + per-role enrichment tables), `property.md`, `ADOPTION.md` §2, `packages/database/src/seed/{foundation-permissions,org-kind-templates}.ts`, `apps/web/lib/api-route.ts`, `apps/web/components/shell/nav-config.ts`, plus external research (Buildium, AppFolio, Yardi, VitaUnits, Kenya platforms).

---

## 0. Binding constraints (from the foundation — do not re-litigate)

1. **One RBAC only.** Domain keys are added to the existing `Permission` catalog and attached to the *existing* kind template roles in `org-kind-templates.ts`. No new role tables, no renames, no parallel capability system. (`BUILD.md` §1.1, `ADOPTION.md` §2.2)
2. **Key format** `resource.action` — singular resource, action vocabulary from `PermissionAction` (`create/read/list/view/update/delete/manage/approve/publish/archive/export/assign/…`). Never `can_edit_x`. (`packages/database/src/authorization/types.ts`)
3. **Server enforcement = `apiRoute({ permissions: '…' })`** (`apps/web/lib/api-route.ts`) on every org-scoped route, always paired with `where: { organizationId: actor.organizationId }` tenant scoping. `protectRoute`/`getServerAuthContext` are unwired placeholders — do not use.
4. **Client gates = `hasUiPermission()`** (`components/shell/use-ui-permission.ts`) — UX only, never security.
5. **Authorization = permission ∧ relationship.** For assigned-scoped roles (technician, caretaker, property_manager) the permission key passes first; then the resource relationship (work-order assignment, staff assignment, management agreement) narrows *which rows*. `ResourceRelationship` is the helper; the domain record (e.g. `PropertyManagementAgreement`) is authoritative. (`BUILD.md` §4)
6. **Seeding is idempotent per org** via `seedOrgKindRoles()` — it upserts roles and `createMany(skipDuplicates)` permission rows, so enriching templates never clobbers owner edits. It **throws if a key is missing from the catalog** → catalog rows must be seeded before org creation runs.
7. **`PermissionKey` template-literal type** in `types.ts` is built from the `ResourceType` enum — every new resource family (`property`, `unit`, `tenant`, `lease`, …) must be added to that enum or the typed key stops compiling. (The runtime seed is plain strings; the enum is the type-level mirror.)

---

## 1. Domain permission catalog (Phase 2 keys)

Legend — **Tier**: `B` = already mandated by BUILD.md Phase 2 scope; `P` = proposed to complete `property.md`'s design; `F` = named in docs but belongs to a later phase (listed so keys are not invented twice).

### 1.1 Property & physical structure

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `property.create` | Create Property | Add a property record | B |
| `property.read` | View Property | Open property detail | B |
| `property.list` | List Properties | Portfolio listing/grid/map | B |
| `property.update` | Update Property | Edit details, media, defaults | B |
| `property.delete` | Delete Property | Remove draft properties only | B |
| `property.archive` | Archive Property | Retire from active portfolio (keeps history) | P |
| `property.manage` | Manage Property | Full property control (owner fallback) | B |
| `unit.create` | Create Unit | Add units/unit types/buildings | P |
| `unit.read` | View Unit | Open unit record | P |
| `unit.list` | List Units | Unit grid/floor plan listing | P |
| `unit.update` | Update Unit | Edit unit details & defaults | P |
| `unit.delete` | Delete Unit | Remove unit record | P |
| `unit.manage` | Manage Unit | Full unit control | P |
| `ownership.read` · `ownership.list` · `ownership.create` · `ownership.update` | Property ownership records | Owner parties, shares, effective dates | P |
| `agreement.read` · `agreement.list` · `agreement.create` · `agreement.update` · `agreement.approve` | Management agreements | `PropertyManagementAgreement` lifecycle | P |

Notes:
- Buildings are structure *inside* a property → covered by `property.*` / `unit.*` (no `building.*` family; avoids key sprawl).
- `unit.*` is split out because caretakers/leasing officers touch units constantly but must not reconfigure the property record.

### 1.2 Tenancy

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `tenant.create` | Create Tenant | Add tenant party record | B |
| `tenant.read` | View Tenant | PII-gated tenant profile | B |
| `tenant.list` | List Tenants | Tenant directory | B |
| `tenant.update` | Update Tenant | Edit tenant details | B |
| `tenant.delete` | Delete Tenant | Remove tenant that has no leases | P |
| `tenant.manage` | Manage Tenant | Full tenant control | B |
| `lease.create` | Create Lease | Draft lease | B |
| `lease.read` | View Lease | Open lease + terms | B |
| `lease.list` | List Leases | Lease register | B |
| `lease.update` | Update Lease | Edit draft/active terms (amendment) | B |
| `lease.approve` | Approve Lease | Move pending → scheduled/active (sign-off) | P |
| `lease.manage` | Manage Lease | Full lease lifecycle (renew/terminate/close) | B |
| `application.create` · `application.read` · `application.list` · `application.update` · `application.approve` | Rental applications | Screening→decision workflow (see research-property-3.md §4) | P |
| `document.upload` | Upload Documents | Property/lease/application files | B |

### 1.3 Finance (ledger — research-property-1 scope: keys only; behavior per `property.md` §4)

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `charge.create` · `charge.read` · `charge.list` · `charge.update` · `charge.manage` | Charges | Rent & recurring charge records | B |
| `charge.approve` | Post Charges | Review & post generated charges to the ledger | P |
| `payment.create` · `payment.read` · `payment.list` · `payment.update` · `payment.manage` | Payments | Record/allocate payments | B |
| `expense.create` · `expense.read` · `expense.list` · `expense.update` | Expenses | Submit property expenses | B |
| `expense.approve` | Approve Expenses | **Separation of duty:** approver ≠ submitter | B |
| `adjustment.create` · `adjustment.read` · `adjustment.list` | Adjustments | Credits/waivers/reversals | P |
| `adjustment.approve` | Approve Adjustments | Waivers must be approved separately | B |
| `statement.read` | Read Owner Statements | Per-owner/property collection statements | B |
| `receipt.issue` | Issue Receipts | Evidence for allocated payments | P |
| `reconcile.run` | Run Reconciliation | Property/unit/tenant collection reconciliation | F |

### 1.4 Utility billing

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `utility.read` · `utility.list` · `utility.update` · `utility.manage` | Utility configuration | Types, tariffs, billing methods (metered/fixed/shared) | F (`property.md` §5) |
| `meter.read` · `meter.list` · `meter.create` · `meter.update` | Meters | Meter identity & unit association | F |
| `reading.create` · `reading.read` | Meter readings | Capture/validate readings | F |

### 1.5 Operations (maintenance)

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `maintenance.create` · `maintenance.read` · `maintenance.list` · `maintenance.update` · `maintenance.manage` | Maintenance tickets | Report/track issues | B (`maintenance.*`) |
| `work_order.create` · `work_order.read` · `work_order.list` · `work_order.update` · `work_order.manage` | Work orders | Authorized repair jobs | B |
| `work_order.assign` | Assign Work Orders | Hand a job to staff/provider | P |
| `inspection.create` · `inspection.read` · `inspection.list` · `inspection.update` | Inspections | Site inspections + evidence | B (`inspection.*` for caretaker) |
| `schedule.create` · `schedule.read` · `schedule.list` · `schedule.update` | Schedules | Recurring jobs/visits | B (`schedule.*` for coordinator) |
| `provider.read` · `provider.list` · `provider.create` · `provider.update` | Service providers | Vendor directory | F (Phase 4) |

### 1.6 Marketing, leasing demand & sales

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `listing.create` · `listing.read` · `listing.list` · `listing.update` · `listing.publish` · `listing.manage` | Listings | For-sale / for-rent marketing listings | B (`listing.*` for marketing_agent) |
| `lead.create` · `lead.read` · `lead.list` · `lead.update` · `lead.manage` | Leads | House hunters / buyers / applicants in pipeline | B (`lead.*`) |
| `viewing.create` · `viewing.read` · `viewing.list` · `viewing.update` | Viewings | Scheduled & completed viewings (`PropertyViewing`) | P |
| `offer.create` · `offer.read` · `offer.list` · `offer.update` · `offer.approve` | Offers | Offers on a sale listing; approve = accept offer | P (research-property-4.md) |
| `handoff.create` | Create Handoff | Cross-org: pass a captured lead to a landlord/PM org | B |

### 1.7 Cross-cutting

| Key | Name | Description | Tier |
| --- | --- | --- | --- |
| `document.read` · `document.list` · `document.delete` | Document access | Read/delete beyond upload | P |
| `audit.read` (exists) · `audit.export` (exists) | — | Already in foundation catalog; domain events flow through it | B |

**Total new keys:** Tier B ≈ 60, Tier P ≈ 45, Tier F ≈ 13. The seeder appends all of them to `FOUNDATION_PERMISSIONS` (45 existing keys stay untouched — no renames).

---

## 2. Role → permission assignments per organization kind

Notation: `resource.(a,b,c)` = those action keys for that resource. Foundation keys each role already holds (from `org-kind-templates.ts`) are **not repeated** — this table is only the Phase-2 enrichment. Everything listed is additive.

### 2.1 `LANDLORD` kind (slugs: `owner`, `manager`, `viewer`)

| Role | Domain keys | Rationale |
| --- | --- | --- |
| `owner` | **All Tier B+P keys** across property/unit/ownership/agreement/tenant/lease/application/charge/payment/expense/adjustment/statement/receipt/document/maintenance/work_order/inspection/schedule/listing/lead/viewing/offer | Full control of the workspace; `platform.admin` bypass already exists for system admins |
| `manager` | `property.(create,read,list,update,archive)` · `unit.*(create,read,list,update)` · `ownership.read,list` · `agreement.read,list` · `tenant.(create,read,list,update)` · `lease.(create,read,list,update,approve)` · `application.(read,list,update,approve)` · `charge.(create,read,list)` · `payment.(create,read,list)` · `expense.create` · `receipt.issue` · `document.(upload,read,list)` · `maintenance.*` (no delete) · `work_order.(create,read,list,update,assign)` · `inspection.*(create,read,list,update)` · `schedule.*` (no delete) · `listing.(create,read,list,update,publish)` · `lead.*` (no delete) · `viewing.*` · `offer.(create,read,list,update)` | "Day-to-day operations". Runs the property; **no** `property.delete`, **no** `expense.approve`/`adjustment.approve` (owner approves), **no** role/permission management (already true in Phase 1) |
| `viewer` | `property.read,list` · `unit.read,list` · `tenant.read,list` · `lease.read,list` · `charge.read,list` · `payment.read,list` · `statement.read` · `maintenance.read,list` · `work_order.read,list` · `document.read,list` · `listing.read,list` · `offer.read,list` | Read-only (accountant/family member use case). Note: `tenant.read` shows PII — acceptable here because viewer is an owner-granted role; orgs that disagree can strip it in the matrix editor |

### 2.2 `PROPERTY_MANAGEMENT` kind (slugs: `owner`, `admin`, `property_manager`, `finance_officer`, `finance_approver`, `leasing_officer`, `caretaker`, `maintenance_coordinator`, `member`, `viewer`)

| Role | Domain keys | Rationale |
| --- | --- | --- |
| `owner` | **All Tier B+P keys** (same as landlord owner) | Company principal |
| `admin` | `property.read,list` · `unit.read,list` · `ownership.read,list` · `agreement.read,list` · `tenant.read,list` · `lease.read,list` · `application.read,list` · `charge.read,list` · `payment.read,list` · `expense.read,list` · `adjustment.read,list` · `statement.read` · `document.(read,list)` · `maintenance.read,list` · `work_order.read,list` · `inspection.read,list` · `schedule.read,list` · `listing.read,list` · `lead.read,list` · `viewing.read,list` · `offer.read,list` | Company administration (members/roles/org settings, per Phase 1) needs oversight visibility, **not** operational write or money approval |
| `property_manager` | `property.*(create,read,list,update,archive)` · `unit.*(create,read,list,update)` · `ownership.read,list` · `agreement.read,list,create,update` · `tenant.(create,read,list,update)` · `lease.(create,read,list,update,approve)` · `application.(read,list,update,approve)` · `charge.(create,read,list,approve)` · `payment.(create,read,list)` · `expense.create` · `adjustment.read,list` · `statement.read` · `receipt.issue` · `document.(upload,read,list)` · `maintenance.*` (no delete) · `work_order.(create,read,list,update,assign)` · `inspection.*` · `schedule.*` · `utility/meter/reading` (F-tier: read/create/update) · `listing.(read,list,update)` · `lead.(read,list,update)` · `viewing.*` · `offer.(read,list,update)` | BUILD.md: `property.*, lease.*, tenant.*, maintenance.*`. Operational manager of **assigned** properties → relationship check narrows rows to properties under agreement/assignment |
| `finance_officer` | `property.read,list` · `unit.read,list` · `tenant.read,list` · `lease.read,list` · `charge.(create,read,list,update,approve)` · `payment.(create,read,list,update)` · `expense.(create,read,list,update)` · `adjustment.(create,read,list)` · `statement.read` · `receipt.issue` · `document.(upload,read,list)` · `audit.export` (exists) | BUILD.md: `charge.*, payment.*, expense.create, statement.read`. **Submits** adjustments/expenses but cannot approve them |
| `finance_approver` | `property.read,list` · `unit.read,list` · `tenant.read,list` · `lease.read,list` · `charge.(read,list,approve)` · `payment.read,list` · `expense.(read,list,approve)` · `adjustment.(read,approve)` · `statement.read` | BUILD.md: `expense.approve, adjustment.approve`. **No create** — submit ≠ approve is enforced by keys, not convention |
| `leasing_officer` | `property.read,list` · `unit.read,list` · `tenant.(create,read,list,update)` · `lease.(create,read,list,update,approve)` · `application.*` (incl. approve) · `document.(upload,read,list)` · `charge.read,list` · `lead.(create,read,list,update)` · `listing.(create,read,list,update)` · `viewing.*` | BUILD.md: `lease.*, tenant.*, document.upload`. Sees charge reads to quote rent; no ledger writes |
| `caretaker` | `property.read,list` · `unit.read,list` · `tenant.read` (contact for site work) · `maintenance.(create,read,list,update)` · `work_order.(read,list,update)` · `inspection.(create,read,list,update)` · `document.upload` (photo evidence) | BUILD.md: `inspection.*, work_order.update` + evidence. **Row scope:** only properties with a `PropertyStaffAssignment` |
| `maintenance_coordinator` | `property.read,list` · `unit.read,list` · `maintenance.*(create,read,list,update)` · `work_order.*(create,read,list,update,assign)` · `inspection.(read,list)` · `schedule.*` · `listing.read,list` (optional) · `document.upload` | BUILD.md: `work_order.*, schedule.*`. Owns dispatch, not finance |
| `technician` | `property.read` · `unit.read` · `work_order.(read,list,update)` · `inspection.(create,read,list,update)` | BUILD.md: **scoped to assigned jobs** — permission + `WorkOrderAssignment` relationship |
| `member` | `property.read,list` · `unit.read,list` · `tenant.read,list` · `lease.read,list` · `maintenance.read,list` · `work_order.read,list` · `document.read,list` | Standard staff read access (mirrors Phase-1 `resource.read`) |
| `viewer` | Same as `member` + `charge.read,list` · `payment.read,list` · `statement.read` · `expense.read,list` | Read-only across operations & money |

### 2.3 `MAINTENANCE_COMPANY` kind (slugs: `owner`, `admin`, `coordinator`, `technician`, `viewer`)

| Role | Domain keys | Rationale |
| --- | --- | --- |
| `owner` | All Tier B+P keys | Company principal |
| `admin` | Read/list across `property`, `unit`, `maintenance`, `work_order`, `inspection`, `schedule`, `document` | Same pattern as PM admin |
| `coordinator` | `property.read,list` · `unit.read,list` · `maintenance.*` · `work_order.*` (incl. assign) · `inspection.*` · `schedule.*` · `document.upload` | BUILD.md Phase 2 target; jobs arrive from client orgs (cross-org assignment rows) |
| `technician` | `property.read` · `unit.read` · `work_order.(read,list,update)` · `inspection.*(create,read,list,update)` | Assigned-jobs scope only |
| `viewer` | `property.read,list` · `unit.read,list` · `maintenance.read,list` · `work_order.read,list` · `inspection.read,list` · `document.read,list` | Read-only |

### 2.4 `MARKETING_AGENT` kind (slugs: `owner`, `marketing_agent`, `viewer`)

| Role | Domain keys | Rationale |
| --- | --- | --- |
| `owner` | All marketing keys + foundation owner set | Workspace owner |
| `marketing_agent` | `listing.(create,read,list,update,publish)` · `lead.(create,read,list,update)` · `viewing.(create,read,list,update)` · `document.upload` · `handoff.create` · `property.read,list` (published/shared marketing summaries only — **not** full ops data: no tenant/lease/charge keys) | BUILD.md: `listing.*, lead.*, handoff.create, document.upload`. Their read of a property comes from the *listings shared with them*, not the landlord's full `Property` row — enforce by serving listing-scoped projections |
| `viewer` | `listing.read,list` · `lead.read,list` · `property.read,list` | Read-only marketing view |

### 2.5 Assignment matrix (summary view — keys × roles)

`●` = full action set of that family · `○` = read/list only · `–` = none · `✎` = create/update but no approve/delete · `✔` = approve-only (no create)

| Key family | L owner | L manager | L viewer | PM owner | PM admin | PM prop_mgr | PM fin_ofc | PM fin_appr | PM leasing | PM caretaker | PM maint_coord | PM tech | PM member | PM viewer | MM owner | MM coord | MM tech | MM viewer | MK owner | MK agent | MK viewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| property | ● | ✎ | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ● | ○ | ○ |
| unit | ● | ✎ | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | – | – | – |
| ownership/agreement | ● | ✎ | ○ | ● | ○ | ✎ | – | – | – | – | – | – | – | ○ | – | – | – | – | – | – | – |
| tenant | ● | ✎ | ○ | ● | ○ | ✎ | ○ | ○ | ✎ | ○ | – | – | ○ | ○ | – | – | – | – | – | – | – |
| lease | ● | ✎ | ○ | ● | ○ | ✎ | ○ | ○ | ✎ | – | – | – | ○ | ○ | – | – | – | – | – | – | – |
| application | ● | ✎ | ○ | ● | ○ | ✎ | – | – | ● | – | – | – | ○ | ○ | – | – | – | – | – | – | – |
| charge | ● | ✎ | ○ | ● | ○ | ● | ● | ✔ | ○ | – | – | – | – | ○ | – | – | – | – | – | – | – |
| payment | ● | ✎ | ○ | ● | ○ | ✎ | ● | ○ | – | – | – | – | – | ○ | – | – | – | – | – | – | – |
| expense | ● | ✎ | ○ | ● | ○ | ✎ | ✎ | ✔ | – | – | – | – | – | ○ | – | – | – | – | – | – | – |
| adjustment | ● | – | ○ | ● | ○ | ○ | ✎ | ✔ | – | – | – | – | – | ○ | – | – | – | – | – | – | – |
| statement/receipt | ● | ✎/✎ | ○ | ● | ○ | ✎/✎ | ✎/✎ | ○/– | – | – | – | – | – | ○ | – | – | – | – | – | – | – |
| maintenance | ● | ✎ | ○ | ● | ○ | ✎ | – | – | – | ✎ | ● | – | ○ | ○ | ● | ● | – | ○ | – | – | – |
| work_order | ● | ✎ | ○ | ● | ○ | ✎ | – | – | – | ✎ | ● | ✎ | ○ | ○ | ● | ● | ✎ | ○ | – | – | – |
| inspection/schedule | ● | ✎ | – | ● | ○ | ● / ✎ | – | – | – | ✎ | ✎ / ● | ✎ / – | – | – | ● | ● | ✎ | – | – | – | – |
| document | ● | ✎ | ○ | ● | ○ | ✎ | ✎ | ○ | ✎ | ✎ | ✎ | – | ○ | ○ | ● | ✎ | – | ○ | ● | ✎ | ○ |
| listing/lead/viewing | ● | ● | ○ | ● | ○ | ✎ | – | – | ● | – | – | – | – | ○ | ● | – | – | ○ | ● | ● | ○ |
| offer | ● | ✎ | ○ | ● | ○ | ✎ | – | – | – | – | – | – | – | ○ | ● | – | – | – | ● | ✎ | ○ |
| handoff | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | ● | ● | – |

(L=LANDLORD, PM=PROPERTY_MANAGEMENT, MM=MAINTENANCE_COMPANY, MK=MARKETING_AGENT. Finance keys for kinds without finance roles: intentionally `–`.)

**Open design question for the next phase (flagged, not decided):** should a `LANDLORD` org get the optional `finance_approver`-style split? Recommendation: not by default — landlord `owner` approves; a custom role can be cloned in the existing roles matrix UI if needed.

---

## 3. Enforcement recipe (copy-paste patterns)

### 3.1 API route

```ts
import { apiRoute, RouteError } from '@/lib/api-route';

export const GET = apiRoute({
  permissions: ['property.list', 'property.read'],   // keys, never role slugs
  async handler({ actor, query }) {
    const properties = await prisma.property.findMany({
      where: { organizationId: actor.organizationId, archivedAt: null },
    });
    return { properties };
  },
});

export const PATCH = apiRoute<{ id: string }>({
  permissions: 'property.update',
  async handler({ actor, params, body }) {
    const input = await body();
    const result = await prisma.property.updateMany({
      where: { id: params.id, organizationId: actor.organizationId },
      data: input,
    });
    if (result.count === 0) throw new RouteError(404, 'Property not found');
  },
});
```

### 3.2 Relationship narrowing (assigned roles)

```ts
// technician sees only assigned jobs — permission passed already via apiRoute
const jobs = await prisma.workOrder.findMany({
  where: {
    organizationId: actor.organizationId,
    assignments: { some: { userId: actor.userId, active: true } },
  },
});
```

Management-agreement narrowing (PM org): `property.managedForOrganizationId` (or an `agreement` row with `startsAt ≤ now ≤ endsAt`) must be in the `where`. A PM org user with `property.list` but **no valid agreement** sees zero properties — that is BUILD.md's acceptance criterion.

### 3.3 UI gate

```tsx
const { hasUiPermission } = useUiPermission();
{hasUiPermission('property.create') && <Button onClick={openCreate}>Add property</Button>}
```

### 3.4 Seed-order checklist

1. Add keys to `FOUNDATION_PERMISSIONS` (or a sibling `PROPERTY_PERMISSIONS` array merged in `seed-data.ts`).
2. Extend `ResourceType` in `packages/database/src/authorization/types.ts`.
3. Add key lists to `KIND_TEMPLATE_ROLES` in `org-kind-templates.ts` (pure data change; seeder is already idempotent).
4. Update `org-kind-templates.test.ts` expectations if it asserts exact permission sets (it asserts slug sets today — verify).
5. `npx prisma db push && npx prisma generate`, restart dev server, re-run org creation smoke (`__smoke-org.ts`, `__smoke-marketing.ts`).

---

## 4. Page & navigation inventory

### 4.1 Current state (Phase 1)

`apps/web/components/shell/nav-config.ts` already declares these MENU entries — **half are dead links awaiting this phase**:

| Nav item | Route | uiPermission today | Phase 2 destination |
| --- | --- | --- | --- |
| Overview | `/` (tab) | — | add property KPI cards (property.md §7) |
| Portfolio | `/portfolio` | `resource.read` → swap `property.list` | **build** property index + detail |
| Leasing | `/leasing` | `resource.read` → swap `lease.list` | **build** tenants, applications, leases |
| People | `/people` (tab) | `user.read` | exists (org members — stays) |
| Finances | `/finances` | `resource.read` → swap `charge.list` | ledger pages (Phase 3 skeleton now) |
| Maintenance | `/maintenance` | `resource.read` → swap `maintenance.list` | tickets, work orders, inspections |
| Calendar | `/calendar` | `resource.read` → swap `calendar.read` (or reuse `property.read`) | viewings, inspections, lease dates |
| Documents | `/documents` | `resource.read` → swap `document.read` | document library |
| Reports | `/reports` | `audit.read` | arrears/collection/occupancy reports |
| Settings | `/settings` | — | exists |

Nav additions proposed (keep everything else untouched):

| New nav item | Route | uiPermission | Why |
| --- | --- | --- | --- |
| **Sales** | `/sales` | `listing.list` | Sale pipeline is a distinct workflow (research-property-4.md); fits MARKETING_AGENT and landlord alike |
| **Owners** | `/owners` | `ownership.list` | Owner parties + management agreements (PM orgs & strata); nested alternative `/portfolio/owners` if we want zero new top-level items — **decision needed** |

Mobile tabs stay `Overview, People, More`; new items land in the More sheet, permission-filtered automatically.

### 4.2 Pages to build (routes under `app/(dashboard)/`)

**Portfolio (property & structure)** — gate `property.*`

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/portfolio` | Property index: grid/list + map toggle, filters (type, status, occupancy), bulk archive | `property.list` (`property.create` gates Add) |
| `/portfolio/new` | Property wizard (details → location/pin → structure → media → defaults) | `property.create` |
| `/portfolio/[propertyId]` | Property detail shell with tabs (below) | `property.read` |
| `…/edit` | Edit property | `property.update` |
| `…/units` | Buildings + units grid / floor plan, unit editor | `unit.list` / `unit.update` |
| `…/tenants` | Tenants in this property (cross-link to leasing) | `tenant.list` |
| `…/leases` | Leases for this property | `lease.list` |
| `…/ledger` | Charges/payments snapshot (full ledger in Finances) | `charge.list`, `payment.list` |
| `…/utilities` | Meters, readings, utility configs (F-tier) | `utility.read` |
| `…/maintenance` | Tickets & work orders filtered to property | `maintenance.list` |
| `…/media` | Photos, floor plans, virtual tour | `property.update` |
| `…/documents` | Property documents | `document.read` |
| `…/staff` | Staff & agent assignments, service agreements | `ownership.read`/`property.read` |
| `…/activity` | Audit trail for the property | `audit.read` |
| `/owners` | Owner parties directory | `ownership.list` |
| `/owners/[ownerId]` | Owner detail: properties, shares, statements | `ownership.read`, `statement.read` |
| `/owners/agreements` | Management agreements list + editor | `agreement.list` / `agreement.create` |

**Leasing (tenants & leases)** — gate `tenant.*` / `lease.*` (tenants live under Leasing, since `/people` is org members)

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/leasing` | Leasing dashboard: pipeline (applications → pending signature → scheduled → active), expiries, arrears shortcuts | `lease.list` |
| `/leasing/tenants` | Tenant directory (search, PII-gated) | `tenant.list` |
| `/leasing/tenants/[id]` | Tenant profile: contact, guarantors, leases, ledger, documents, notes | `tenant.read` |
| `/leasing/tenants/new` | Add tenant | `tenant.create` |
| `/leasing/applications` | Application/screening queue | `application.list` |
| `/leasing/applications/[id]` | Application review + decision | `application.approve` |
| `/leasing/leases` | Lease register (status, dates, rent, unit(s)) | `lease.list` |
| `/leasing/leases/new` | Lease wizard (parties → units → dates → rent/deposit → documents → send for signature) | `lease.create` |
| `/leasing/leases/[id]` | Lease detail: terms, LeaseUnits, charge rules, documents, timeline, renew/notice/close actions | `lease.read` / `lease.manage` |

**Finances** (skeleton now; full behavior Phase 3) — gate `charge.*` / `payment.*`

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/finances` | Ledger overview: billed vs collected, outstanding, overdue | `charge.list`, `payment.list` |
| `/finances/charges` | Charge register (post, void, source trace) | `charge.list` (`charge.approve` to post) |
| `/finances/payments` | Payments + allocation workspace (partial/multi/unallocated) | `payment.list` (`payment.create`) |
| `/finances/adjustments` | Credits/waivers queue | `adjustment.list` (`adjustment.approve`) |
| `/finances/statements` | Owner statements | `statement.read` |

**Maintenance** — gate `maintenance.*` / `work_order.*` / `inspection.*`

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/maintenance` | Board: tickets → work orders → done; SLA/overdue alerts | `maintenance.list` |
| `/maintenance/tickets/[id]` | Ticket detail | `maintenance.read` (`maintenance.update`) |
| `/maintenance/work-orders` + `/[id]` | Work orders, assignment, costs, provider | `work_order.list` / `work_order.update` (`work_order.assign`) |
| `/maintenance/inspections` | Inspection schedules & reports | `inspection.list` |
| `/maintenance/schedule` | Recurring jobs | `schedule.list` |
| `/maintenance/providers` | Service provider directory (F-tier) | `provider.list` |

**Sales pipeline** (research-property-4.md) — gate `listing.*` / `lead.*` / `offer.*`

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/sales` | Pipeline board: listings → leads → viewings → offers → closed | `listing.list` |
| `/sales/listings` + `/[id]` + `/new` | Listing CRUD, publish, media, price history | `listing.read` / `create` / `publish` |
| `/sales/leads` + `/[id]` | Lead inbox (house hunters), qualification, match properties | `lead.list` / `lead.update` |
| `/sales/viewings` | Viewing scheduler + feedback capture | `viewing.list` |
| `/sales/offers` + `/[id]` | Offer comparison, negotiation, acceptance | `offer.list` (`offer.approve`) |
| `/sales/deals/[id]` | Deal room: checklist (search, consents, docs), commission, completion | `offer.read` + `document.upload` |
| `/sales/handoff/[id]` | Cross-org handoff (MARKETING_AGENT → landlord/PM) | `handoff.create` |

**Shared / cross-cutting**

| Route | Purpose | Key permissions |
| --- | --- | --- |
| `/calendar` | Unified: viewings, inspections, work orders, lease start/end, rent due | `property.read` (any domain read) |
| `/documents` | All documents, filter by property/lease/tenant | `document.read` |
| `/reports` | Occupancy, arrears, collection rate, lease expiries, funnel conversion | `audit.read` (refine later) |
| `/` (Overview) | KPI cards: units occupied, billed vs collected, outstanding, alerts | reuses `property.list` etc. |

### 4.3 Per-page security checklist (mandatory — from `AGENTS.md`)

- [ ] Route declared with `apiRoute` + domain permission **keys**
- [ ] Every query filtered by `organizationId`
- [ ] Mutations use `updateMany`/`deleteMany` with org scope (or fetch-then-verify)
- [ ] Assigned roles additionally filtered by relationship (agreement/staff/assignment)
- [ ] Destructive/privileged controls gated with `hasUiPermission`
- [ ] PII pages (`tenant.*`) never cached client-side across orgs; `tenant.read` on every view
- [ ] Audit entries for create/update/approve on `property`, `lease`, `charge`, `payment`, `adjustment`, `offer`
- [ ] Permission keys exist in seed before the route is reachable (seeder throws otherwise)

---

## 5. Competitor role/permission precedents (why these shapes)

- **Buildium** — default editable user roles with per-menu access levels (`View/Edit/Delete/Hide`), plus **property-level access limitation** ("this user can only view the following properties") and a dedicated **Leasing Agent** role that sees properties/listings/applicants/leases but no financial reporting. Precedents we mirror: (a) read-only finance roles, (b) leasing-only role, (c) property-scoped access = our relationship narrowing. (help.buildium.com — "User Roles and staff member access")
- **AppFolio** — custom user roles, audit logs, separate Owner/Vendor/Resident portals. Precedent: portals are role-scoped projections, not separate systems.
- **Yardi Retail Manager** — mall-specific leasing roles (deal pipeline, stacking/floor plans). Precedent: retail leasing gets its own pipeline views (we cover in research-property-3/4).
- **NIST RBAC** framing used by commercial software comparisons: permissions attach to *functions* (approve vs submit), which is exactly our `finance_officer`/`finance_approver` split.
- Our Phase-1 templates already encode these shapes — Phase 2 only adds domain keys to them.

---

## 6. Decisions to confirm before implementation

1. **New top-level nav:** add `Sales` and `Owners`, or nest (`/leasing/sales`, `/portfolio/owners`)? Recommendation: top-level `Sales` (it spans marketing agent kind too); `Owners` nested under `/portfolio/owners` to avoid nav bloat.
2. **`tenant.delete`/`property.delete`** — recommendation: soft `archive` for anything with history; hard delete only for drafts (enforced server-side).
3. **Whether `admin` gets any domain write** — current proposal is read-only domain + org admin. Confirm.
4. **`calendar.read`** key vs reusing `property.read` for the calendar page — recommendation: no new key; calendar renders per-domain rows the user can already read.
5. **Tier-B key count (~60)** is large for one seeding change — recommend landing in two batches: (1) property/unit/tenant/lease + nav/portfolio/leasing pages, (2) finance/ops/sales keys with their pages.
