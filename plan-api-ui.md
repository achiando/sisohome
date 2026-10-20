# Phase 2 — API + UI Build Plan (index)

Living implementation plan for the property-domain **API routes and pages**, built as vertical slices (API + UI together per slice). Research basis: `property.md`, `research-property-1..4.md`, `STATUS.md` (batches 1–5 of the DB are complete: 150 permission keys, all models).

## Slices (build order)

| # | Plan file | Scope | Nav destination |
| --- | --- | --- | --- |
| 0 | `plan-slice-0-foundation.md` | Scope helpers, domain service layer, shared form/list patterns, nav key swap | — |
| 1 | `plan-slice-1-portfolio.md` | Properties, buildings/units/unit-types, ownership, PM agreements, staff assignment, documents, activity — incl. **who creates property** and **property assignment** | `/portfolio` |
| 2 | `plan-slice-2-leasing.md` | Tenants, applications, leases (+ portal invite create) | `/leasing` |
| 3 | `plan-slice-3-maintenance.md` | Tickets, work orders (cross-org MM), inspections, schedules | `/maintenance` |
| 4 | `plan-slice-4-finances.md` | Charge schedules, charges (post), payments, allocations, adjustments, receipts, statements, overview | `/finances` |
| 5 | `plan-slice-5-sales.md` | Listings, leads, viewings, offers, deals, cross-org handoffs | `/sales` (new nav) |
| 6 | `plan-slice-6-cross-cutting.md` | Calendar, documents library, Overview KPIs, thin reports | `/calendar`, `/documents`, `/`, `/reports` |
| 7 | `plan-slice-7-portal.md` | Tenant portal: invite-accept, portal guard, tenant-scoped views | `/portal/*` (separate shell) |

Each slice ends **green**: `npx tsc -p packages/database` (if touched) · `pnpm typecheck` 9/9 · `pnpm lint` 9/9 (0 errors) · live API smoke on the dev server · matrix test still passing.

---

## Global conventions (apply to every slice)

### A. API routes

- Every route = `apiRoute` from `@/lib/api-route`; permission **keys** (never role slugs); `actor.organizationId` non-null.
- Route files are thin: validate input → call domain service → return `ok(...)`/`RouteError`.
  ```ts
  import { apiRoute, ok, RouteError } from '@/lib/api-route';
  import { propertyService } from '@/lib/domain/property';
  export const GET = apiRoute({ permissions: 'property.list',
    async handler({ actor, query }) { return { properties: await propertyService.list(actor, query) }; } });
  ```
- **Service layer**: `apps/web/lib/domain/<domain>.ts` — functions take `actor: { userId, organizationId }`, own all scoping, call `db` (`prisma`, re-exported from `@/lib/auth`), throw `RouteError`/`AccessError`. Never let a route hand raw user filters to Prisma without a scope predicate.
- **Audits**: mutations call `new AuditService(db).log({ ... , resourceType: 'property'|'charge'|… })` (generic string resourceType — no per-domain table).
- **Input validation**: manual field-by-field (repo convention, no zod); trim strings, validate enums against schema values, decimals as strings → `Decimal`.
- **Creates** return `ok({ x }, { status: 201 })`; updates/deletes `void` → implicit `ok()`.

### B. Scoping — the single most important rule (permission ∧ relationship)

**1. Property rows** use one shared predicate factory (slice 0: `lib/domain/property-scope.ts`):

```ts
// who can see/act on which properties
propertyScopeWhere(actor) = {
  OR: [
    { portfolioOrganizationId: actor.organizationId },                                   // owner of the portfolio
    { managementAgreements: { some: {                                                    // PM *and* MM with an active agreement
        managementOrganizationId: actor.organizationId, status: 'ACTIVE',
        startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } } },
    { staffAssignments: { some: { userId: actor.userId, isActive: true,
        startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } } },  // assigned staff (any org)
    { workOrders: { some: { assignments: { some: {
        assigneeOrganizationId: actor.organizationId } } } } },                          // MM reached per-job
  ],
}
```

**2. Child rows** (units, leases, charges, tickets, listings…) carry `organizationId` = the property's **portfolio** org — which is often NOT the caller's org (PM/MM). Therefore:

- **List/read**: scope children *through the parent*: `where: { …filters, property: propertyScopeWhere(actor) }`. Never filter children by `organizationId: actor.organizationId` alone (silently returns zero rows for managed orgs) and never without a parent scope (leaks other orgs' rows).
- **Mutations**: fetch child → load parent property (or its `portfolioOrganizationId`) → verify with `propertyScopeWhere` + the required permission → then `updateMany({ where: { id, organizationId: <child's own> } })` (count 0 → 404). Documented per route in each slice file.
- **Create**: the new child inherits `organizationId` = parent property's `portfolioOrganizationId` (never the actor's org, except when the actor IS the portfolio org — same thing then).

**3. MARKETING_AGENT is projection-only**: MK orgs never run `propertyScopeWhere` against full `Property` rows. They read `Listing` rows where `marketingOrganizationId = actor.organizationId` (or their own `organizationId`) and the API serves **listing-scoped projections** (title, price, address summary, media), never the full Property. Listing mutations are org-scoped: their own listings = `organizationId = actor.organizationId`; shared-to-them listings = read-only projection.

**4. `hasUiPermission` gates every action button/link; the matching `permissions:` on `apiRoute` is the real gate.**

### C. UI conventions

**1. Create + edit = independent routes sharing ONE form component (mandatory pattern):**

```
app/(dashboard)/portfolio/page.tsx                       # list
app/(dashboard)/portfolio/new/page.tsx                   # create page  ─┐
app/(dashboard)/portfolio/[propertyId]/edit/page.tsx     # edit page    ─┴─ both render:
app/(dashboard)/portfolio/_components/property-form.tsx  # ← THE shared form
```

Shared form contract (every entity follows this):

```tsx
// _components/entity-form.tsx  ('use client')
export interface EntityFormProps {
  mode: 'create' | 'edit'
  initialValues?: Entity          # omitted in create
  saving: boolean
  serverErrors?: Record<string, string>
  onSubmit: (values: FormValues) => Promise<void>   # page owns fetch + navigation
  onCancel: () => void
}
export function EntityForm(props: EntityFormProps) {
  const [values, setValues] = useState(seed(props.initialValues))
  // UniversalForm (variant 'wizard' for multi-section entities, 'standard' otherwise)
  // local validate() → errors; submit → props.onSubmit(values)
}
```

- Pages stay thin: fetch (edit) / seed defaults (create) → render `<EntityForm mode … onSubmit>` → parent performs `POST`/`PATCH` → `toast.success` → `router.push` to detail/list.
- Edit page **404-gates**: GET fails → toast + redirect to list.
- `key` by entity id if a page ever hosts the form inline (dialog pattern, cf. `people/_components/member-form.tsx`).
- Forms use `UniversalForm` (`@workspace/ui/components/form`) with `sections: FormSection[]`; multi-step entities (property, lease) use `variant="wizard"` **in both modes** so create and edit are literally the same tree.

**2. List pages**: `'use client'` + `ResponsiveDataListing` (`@workspace/ui/components/shared`) — `loading`/`skeletonCount`, `searchQuery` + client `useMemo` filters, `primaryAction` gated by `hasUiPermission`, `emptyState`, desktop `ColumnDef[]` + mobile `CardMapper`. (Repo has no pagination yet — fetch full scoped list, client-filter.)

**3. Data fetching**: plain `fetch(url, { credentials: 'include' })` + `useState/useEffect`, `toast.error` on failure, mutations with `Content-Type: application/json`, optimistic update + revert for status toggles (people-page pattern). Pages must not add gutters (AppShell owns them).

**4. Tabs within detail pages** (property detail, tenant detail…) = client tab state + per-tab lazy fetch; deep-linkable via `?tab=` searchParam where cheap.

### D. Security checklist per route/page (from `research-property-1 §4.3`)

- [ ] `apiRoute` + domain permission **key(s)**
- [ ] List/read scoped via `propertyScopeWhere` (or `organizationId` when the resource is flat-org)
- [ ] Mutation: fetch → verify scope → scoped `updateMany` (count → 404)
- [ ] Create: child `organizationId` = parent portfolio org
- [ ] Cross-org rows (agreements/MM assignments/handoffs) matched **both ways** (as owner and as counterparty)
- [ ] Actions gated `hasUiPermission` on the page
- [ ] `AuditService.log` on create/update/approve for property, lease, charge, payment, adjustment, offer, handoff
- [ ] PII (`tenant.*`) never cached across orgs

### E. Verification per slice

```bash
pnpm --filter @workspace/database test                 # matrix guard (if templates touched)
npx tsc -p packages/database --noEmit                 # if DB package touched
pnpm typecheck && pnpm lint                           # 9/9, 0 errors
cd apps/web && (setsid pnpm dev > /tmp/opencode/dev-server.log 2>&1 &) ; sleep 14
# scripted API smoke: login → exercise each new route (2xx + 403 negatives for wrong kind)
```
E2E page smokes stay Phase-1-only for now; per-slice API smokes use the existing session helpers (`packages/database/src/seed/__smoke-db.ts`).

---

## Decisions log (locked — do not relitigate while building)

1. **Who creates/handles property**: LANDLORD owner+manager, PM owner+property_manager, MM **owner only** may create property (their own portfolio, `portfolioOrganizationId = own org`). MK never creates property (read-only marketing). All owner templates hold identical key sets (matrix guard) — enforcement is per-route permission, not kind checks.
2. **Two assignment modes**: (a) *own portfolio* — creator's org becomes portfolio org; (b) *managed for others* — landlord/PM-owned property linked to a PM/MM org by `PropertyManagementAgreement` (row lives in portfolio org; `agreement.create` by either side, **`agreement.approve` only by owner-side templates** → status ACTIVE). MM additionally reached per-job via `WorkOrderAssignment.assigneeOrganizationId`; staff via `PropertyStaffAssignment` (row-scope for assigned roles like caretaker); MK via `Listing.marketingOrganizationId` (projection only).
3. **Agreement is one row per managed property** (portfolio-wide contract = one row per covered property).
4. **Create/edit pages are independent routes sharing one form component** (pattern in §C.1) — no duplicated form logic, no modal-only editing for primary entities.
5. **Delete policy**: hard delete only DRAFT property/units with no dependent rows; everything else archive/status (server-enforced).
6. **Scope helper is the single choke point** — every slice uses `propertyScopeWhere` (children via parent). No ad-hoc `organizationId` filters on child tables.
7. Calendar gets **no new permission key** (renders rows the user can already read). Reports stay thin in this wave (full analytics = Phase 3).
8. Portal (slice 7) ships **after** org-side slices; invite-create lives in slice 2, accept flow + portal shell in slice 7.

## Open (non-blocking) choices — decide at slice start

- Map embed on property detail: static OSM tile vs link-out only (links always work; tile needs no key).
- Bulk-unit generator UI: dialog on units tab (recommended) vs dedicated page.
- Sales pipeline board first cut: column-per-status board vs status-filtered table (table ships first, board upgrades later).
