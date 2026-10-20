# Slice 0 — Foundation (scope helpers, domain services, shared patterns, nav)

Smallest slice. Everything later depends on these. Touches: `apps/web/lib/` + nav config only — **no new pages yet** (nav links light up per slice as their pages land).

## 1. Property scope predicate — `apps/web/lib/domain/property-scope.ts`

The one choke point for permission ∧ relationship on property-domain data.

```ts
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import type { Prisma } from '@workspace/database';

type Actor = { userId: string; organizationId: string };

export function propertyScopeWhere(actor: Actor): Prisma.PropertyWhereInput {
  const now = new Date();
  return {
    OR: [
      // 1. Own portfolio (landlord / PM or MM owner's own assets)
      { portfolioOrganizationId: actor.organizationId },
      // 2. Active management agreement — covers PM *and* MM whole-property ops
      { managementAgreements: { some: {
          managementOrganizationId: actor.organizationId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      } } },
      // 3. Direct staff assignment (caretaker / assigned PM staff — any org)
      { staffAssignments: { some: {
          userId: actor.userId, isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      } } },
      // 4. Maintenance company reached per-job (has an assigned work order)
      { workOrders: { some: { assignments: { some: {
          assigneeOrganizationId: actor.organizationId } } } } },
    ],
  };
}
```

Exported helpers (same file or siblings):

| Helper | Purpose |
| --- | --- |
| `assertPropertyInScope(actor, propertyId)` | `db.property.findFirst({ id, ...scope })` → else `RouteError(404)` (use: create-child, invite flows — never leak existence with 403) |
| `scopedPropertyInclude` / `childScope(actor, extra)` | `{ property: propertyScopeWhere(actor), ...extra }` — the standard child `where` fragment |
| `resolveChildUpdateScope(child)` | for mutations: load child + parent → `assertPropertyInScope` → return `{ id: child.id, organizationId: child.organizationId }` for `updateMany` |
| `listingProjectionScope(actor)` | MK read side: `OR: [{ organizationId: actor.organizationId }, { marketingOrganizationId: actor.organizationId }]` on **Listing only** — never Property |

Unit tests: **not** wired into the matrix test (DB-dependent); covered by per-slice smoke negatives (PM org with no agreement sees 0, sees 1 after agreement ACTIVE).

## 2. Domain service layer — `apps/web/lib/domain/`

One file per domain, created as its slice lands (slice 0 creates the directory + the shared audit helper):

```
apps/web/lib/domain/
├── audit.ts            # auditLog(actor, resourceType, action, resourceId, meta?) wrapping AuditService
├── property-scope.ts   # above
├── property.ts         # slice 1
├── unit.ts             # slice 1 (buildings, units, unit-types)
├── ownership.ts        # slice 1 (owner-parties, ownerships, agreements, staff)
├── documents.ts        # slice 1 (polymorphic documents + versions)
├── tenant.ts / application.ts / lease.ts      # slice 2
├── maintenance.ts / work-order.ts / inspection.ts / schedule.ts   # slice 3
├── finance.ts (charges, schedules) / payment.ts / adjustment.ts   # slice 4
├── sales.ts (listings, leads, viewings) / offer.ts / handoff.ts   # slice 5
```

Service function signature convention:

```ts
export async function list(actor: Actor, opts: { q?: string; status?: string }) → …
export async function create(actor: Actor, input: unknown) → …   // validates, sets organizationId from parent scope
export async function update(actor: Actor, id: string, input: unknown) → …  // fetch → assertScope → updateMany
export async function remove(actor: Actor, id: string) → …
```

`audit.ts`:

```ts
import { AuditService, type AuditLogData } from '@workspace/database'; // verify exact export
const auditService = new AuditService(db);
export async function auditLog(actor, resourceType, action, resourceId, meta?) {
  await auditService.log({ userId: actor.userId, organizationId: actor.organizationId,
    resourceType, resourceId, action, metadata: meta });  // fields confirmed against audit.service.ts at build time
}
```

## 3. Shared UI primitives — `apps/web/app/(dashboard)/_components/domain/`

| File | Contents |
| --- | --- |
| `page-header.tsx` (or reuse existing patterns) | title + description + gated `primaryAction` slot — if the shell already provides headers via `ResponsiveDataListing`, skip; confirm at build |
| `detail-tabs.tsx` | controlled tabs helper: `tabs: {id,label,badge?}[]`, `?tab=` URL sync, lazy panel render |
| `scope-denied.tsx` | the "Access denied" Card pattern (from settings/roles) + back button — used when a detail page fails `assertPropertyInScope` (404 → redirect w/ toast instead; this is the fallback) |
| `money.ts` / `format.ts` | KES formatting, date short forms — only if not already in `@workspace/ui` (check first) |

**Shared-form contract**: documented in `plan-api-ui.md` §C.1 — each slice ships `_components/<entity>-form.tsx` implementing `EntityFormProps`. Slice 1's `property-form.tsx` is the reference implementation; later slices copy its shape.

## 4. Nav wiring — `components/shell/nav-config.ts`

```ts
// replace resource.read placeholders with real domain keys:
{ label: 'Portfolio',   href: '/portfolio',   uiPermission: 'property.list' },
{ label: 'Leasing',     href: '/leasing',     uiPermission: 'lease.list' },
{ label: 'Finances',    href: '/finances',    uiPermission: 'charge.list' },
{ label: 'Maintenance', href: '/maintenance', uiPermission: 'maintenance.list' },
{ label: 'Documents',   href: '/documents',   uiPermission: 'document.read' },   // slice 6
{ label: 'Calendar',    href: '/calendar',    uiPermission: 'property.read' },   // no new key (decision 7)
{ label: 'Reports',     href: '/reports',     uiPermission: 'audit.read' },
// NEW top-level entry (decision: top-level Sales):
{ label: 'Sales',       href: '/sales',       uiPermission: 'listing.list' },
```

- **Do NOT remove dead links** — nav hides items the session lacks keys for; dead links for permitted keys are fixed as each slice lands (Portfolio in slice 1 etc.). Land the key swap here so gating is right from the first page.
- Owners stays nested (`/portfolio/owners`) — no top-level entry (decision: nav-bloat).
- Mobile tabs unchanged (`Overview, People, More`); Sales lands in the More sheet automatically.

## 5. Out of scope for slice 0

- No pages, no API routes, no schema changes.
- Not doing: generic fetch wrapper (repo convention = raw fetch), pagination, zod.

## 6. Acceptance

- [ ] `propertyScopeWhere` + helpers typed against generated Prisma client; `pnpm typecheck` 9/9, `pnpm lint` 9/9
- [ ] `apps/web/lib/domain/` exists with `property-scope.ts` + `audit.ts` (audit signature verified against `packages/database/src/audit/audit.service.ts`)
- [ ] Nav keys swapped; People/Settings/Others unaffected (visual check)
- [ ] Matrix test still passes (templates untouched)
