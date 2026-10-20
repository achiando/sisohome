# Slice 6 — Cross-cutting (Overview KPIs, Calendar, Documents library, thin Reports)

Thin glue over APIs from slices 1–5. **No new schema, no new permission keys** (calendar = `property.read`-style reuse per decision 7; reports = `audit.read` gate for now).

## 1. Overview `/` (upgrade existing placeholder page)

- **Data**: `GET /api/finances/overview` (slice 4) + lightweight `GET /api/overview` aggregator (new, `permissions: []`-free → requires only org membership; composes scoped counts):
  ```
  { properties: {total, active}, units: {total, occupied}, leases: {active, expiringIn30d},
    finances: {billed, collected, outstanding, overdueCount},
    maintenance: {openTickets, inProgressWO}, sales: {activeListings, hotLeads} }
  ```
  Each sub-count scoped with `propertyScopeWhere` / domain scopes; **skip fields whose keys the session lacks** (compute only sections the caller could read: e.g. no `charge.list` → omit finances) — server respects permissions even though route is open to members (avoids leaking numbers the user can't otherwise see).
- **UI**: KPI card grid (existing `Card`), alert strip (expiring leases, overdue count), quick-add actions gated (`property.create`, `lease.create`, `payment.create`). LAND category orgs: hide occupancy KPI, show sale-pipeline stats instead (research-3 rule: never `0/0`).

## 2. Calendar `/calendar`

- **API**: `GET /api/calendar?from=&to=` (any authenticated org member; per-row filtering done via per-domain scopes):
  ```
  events = [
    …viewings   (property scope OR agentUserId)   → {type:'viewing', at: scheduledAt, label}
    …inspections(property scope)                  → scheduledFor
    …workOrders (property scope)                  → scheduledFor
    …recurring schedules (property scope)         → nextDueAt
    …leases startsAt/endsAt/noticeDate (property scope)
    …charge dueDates (property scope)             → {type:'rent_due'}   // gate charge.list internally
  ]
  ```
  Internal gates: only include event classes the caller's permissions allow (viewing needs `viewing.list`, charges `charge.list`, …). Returns flat sorted `Event[]`.
- **UI**: month grid + agenda toggle (build on plain components — no calendar lib dependency unless already present; **check `packages/ui` for calendar; if absent, ship month grid with date-cell event dots + list view**). Click-through to the entity's detail route.

## 3. Documents library `/documents`

- **API**: `GET /api/documents/library?entityType=&propertyId=&kind=&q=` — polymorphic list across entities in scope: resolve per entity-type relation with `property: propertyScopeWhere(actor)` + flat OWNERSHIP/OWNER_PARTY (actor's org). Pagination later (client filter now). Requires `document.read`.
- **UI**: table (name/kind, entity link chip [Property/Unit/Lease/Tenant…], uploaded date), filters, upload entry (creates via existing `POST /api/documents` with entity picker dialog). Per-entity tabs from earlier slices remain the primary surface; this is the cross-entity view.

## 4. Reports `/reports` (thin)

- **API**: `GET /api/reports/summary?from=&to=` gated `audit.read` (matrix gate today):
  - occupancy by property (derived: occupied/total units, exclude LAND)
  - arrears: posted charges outstanding by property + top debtors (name + amount, needs `tenant.read` else aggregate only)
  - collection rate: collected/billed in range
  - lease expiries next 30/60/90d
  - funnel: leads by status + conversion (viewings→offers→won)
- **UI**: report cards with simple bar/table renderings + property filter + CSV export (client-side blob) — no charts library dependency (CSS bars); deeper analytics = Phase 3.
- Route: `/reports` replaces the `audit.read` dead link; per-research §4.2 refine gate later.

## 5. Nav finalization

After this slice every MENU entry resolves to a real page (except deferred `/guide`, `/faq`, `/support` help items — existing dead links, out of wave). `uiPermission`s already swapped in slice 0.

## 6. Sequencing & acceptance

1. `GET /api/overview` + Overview page rebuild
2. Calendar API + page
3. Documents library
4. Reports summary + page
5. Verify: typecheck/lint; smoke: overview numbers cross-check against direct list endpoints for same session; calendar shows mixed events; MM session calendar only shows its scoped rows (assigned/agreement properties); reports aggregate-only without `tenant.read` (use MM viewer); dead-nav check on all four kinds (each kind's nav shows only permitted items).
