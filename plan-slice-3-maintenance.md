# Slice 3 — Maintenance (tickets, work orders, inspections, schedules)

The **cross-org slice**: MM orgs enter the picture via `WorkOrderAssignment.assigneeOrganizationId`. Models: `MaintenanceTicket`, `WorkOrder`, `WorkOrderAssignment`, `Inspection`, `RecurringSchedule` (batch 4).

## 1. Scoping (two directions)

MM orgs are the party on the other side of assignments, so queries are symmetric — always match both directions where the row itself belongs to the portfolio org:

- **Property-child rows** (ticket, work order, inspection, schedule): `where: { …, property: propertyScopeWhere(actor) }` — MM reaches property via arm 4 (has assigned WO) or arm 2 (agreement).
- **Assignment rows** (`WorkOrderAssignment`): `organizationId` = portfolio org; MM matches via `assigneeOrganizationId = actor.organizationId`; portfolio side via `organizationId = actor.organizationId`. List: `OR: [ {organizationId: actor.organizationId}, {assigneeOrganizationId: actor.organizationId} ]`.
- **Technician person-scope (decided)**: the security boundary is **org-level** (agreement/assignment isolation between companies). Inside an org, every member who passes `apiRoute` reads all rows of that org's scope; technicians get a **`?scope=mine` UX filter** (rows where `assignments.some({ assigneeUserId: actor.userId })`) defaulted in their UI — not a server-side block, because role templates cannot express per-row person scoping and person-level isolation inside a trusted company is out of scope for v1.

## 2. Ticket → work order lifecycle (state machines in the service)

```
MaintenanceTicket: OPEN → IN_PROGRESS → RESOLVED → CLOSED  (ON_HOLD, CANCELLED anywhere)
WorkOrder:        PENDING → AUTHORIZED → SCHEDULED → IN_PROGRESS → COMPLETED   (ON_HOLD, CANCELLED)
Assignment:       ASSIGNED → DECLINED | COMPLETED
Inspection:       SCHEDULED → IN_PROGRESS → PASSED | FAILED   (CANCELLED)
```

Transitions enforced by a `canTransition(from, to)` map per status enum → illegal → 409. Audit on create/update/assign/complete.

**Escalation**: `POST /api/maintenance/tickets/[id]/create-work-order` (`work_order.create`) — one WO per ticket initially (`ticketId`); ticket status auto → IN_PROGRESS on WO AUTHORIZED.

**Costs**: `estimatedCost` set pre-authorization; `finalCost` on completion (`work_order.update`); no approval-money keys here (estimates aren't payouts — payouts would be expense.*, slice 4).

## 3. API routes (`lib/domain/maintenance.ts`, `work-order.ts`)

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/maintenance/tickets` | `maintenance.list` | parent scope; filters status/priority/category/propertyId |
| `POST /api/maintenance/tickets` | `maintenance.create` | parent scope; `organizationId`=portfolio org; actor userId recorded in `reportedByUserId`; `unitId` must belong to property (400 otherwise) |
| `GET /api/maintenance/tickets/[id]` | `maintenance.read` | scope; include work orders + assignments (assignee contact needs `user.read` else mask) |
| `PATCH /api/maintenance/tickets/[id]` | `maintenance.update` | fetch→scope→updateMany |
| `POST /api/maintenance/tickets/[id]/transition` | `maintenance.update` | body `{to}` via map; RESOLVED sets `resolvedAt`, CLOSED sets `closedAt` |
| `POST /api/maintenance/tickets/[id]/work-orders` | `work_order.create` | creates WO (PENDING) linked to ticket |
| `GET /api/work-orders` | `work_order.list` | parent scope (MM reaches via arm 4/2); `scope=mine` UX filter; include assignments, ticket ref, unit |
| `POST /api/work-orders` | `work_order.create` | standalone WO (no ticket) allowed; parent scope; `organizationId`=portfolio |
| `GET /api/work-orders/[id]` | `work_order.read` | scope; include assignments + inspections |
| `PATCH /api/work-orders/[id]` | `work_order.update` | scope; costs/dates/notes |
| `POST /api/work-orders/[id]/authorize` | `work_order.update` | PENDING→AUTHORIZED, `authorizedAt/by` — **portfolio org only?** decision: ANY side may authorize if their keys allow; typically portfolio org. Keep simple: valid scope + transition |
| `POST /api/work-orders/[id]/assign` | `work_order.assign` | body `{ assigneeUserId, assigneeOrganizationId? }`; assignee user must be member of `assigneeOrganizationId` (or actor's org when null) → 400 else; creates `WorkOrderAssignment` (ASSIGNED); **this is the MM cross-org hook** — no agreement needed |
| `PATCH /api/work-order-assignments/[id]` | `work_order.update` | DECLINE/COMPLETED (assignee side via `assigneeOrganizationId` OR `assigneeUserId=actor.userId`) |
| `POST /api/work-orders/[id]/transition` | `work_order.update` | map above; COMPLETED sets `completedAt` (+`finalCost` if given); auto-marks open assignments COMPLETED (transaction) |
| `GET/POST /api/maintenance/inspections` | `inspection.list`/`inspection.create` | parent scope; `inspectorUserId` must be an org member (any member — cross-org inspectors via assignment later; keep member check) |
| `PATCH /api/maintenance/inspections/[id]` + `/complete` | `inspection.update` | scope; complete requires findings when FAILED |
| `GET/POST /api/maintenance/schedules` | `schedule.list`/`schedule.create` | parent scope; `assigneeUserId` member check; `nextDueAt` computed from frequency on create |
| `PATCH/DELETE /api/maintenance/schedules/[id]` | `schedule.update` | scope; DELETE = `isActive=false` (soft — recurring history) |

Documents: `entityType=WORK_ORDER/INSPECTION` uploads ride slice-1 documents API (quotes, completion photos, evidence).

## 4. UI pages

| Route | Purpose | Gate |
| --- | --- | --- |
| `/maintenance` | board: columns OPEN/IN_PROGRESS/RESOLVED (cards: priority chip, property, age, assignee org) + overdue filter; secondary tabs: Tickets \| Work orders list | `maintenance.list` |
| `/maintenance/tickets/[id]` | detail: status stepper w/ transition buttons, WO list + **Create work order**, reporter, unit link, activity | `maintenance.read` |
| `/maintenance/tickets/new` | `<TicketForm mode="create">` (property→unit cascading picker, category, priority) | `maintenance.create` |
| `/maintenance/tickets/[id]/edit` | `<TicketForm mode="edit">` | `maintenance.update` |
| `/maintenance/work-orders` | list: status filter, cost columns, assignee org; **scope toggle: All / My jobs** | `work_order.list` |
| `/maintenance/work-orders/new` | `<WorkOrderForm mode="create">` (property/unit, optional ticket link, estimate) | `work_order.create` |
| `/maintenance/work-orders/[id]` | detail: stepper, costs, **Assign dialog** (user picker org-aware + "external maintenance company" org picker → `assigneeOrganizationId`), assignments list w/ decline/complete actions, inspections, docs | `work_order.read` |
| `/maintenance/work-orders/[id]/edit` | `<WorkOrderForm mode="edit">` | `work_order.update` |
| `/maintenance/inspections` | list + calendar-ish grouping by scheduledFor | `inspection.list` |
| `/maintenance/inspections/new` + `/[id]/edit` | shared `InspectionForm` | `inspection.create/update` |
| `/maintenance/schedule` | recurring jobs list + next due | `schedule.list` |
| `/maintenance/schedule/new` + `/[id]/edit` | shared `ScheduleForm` | `schedule.create/update` |

Board implementation: status-filtered card columns built on existing shared components (`CardMapper`); full kanban DnD deferred.

## 5. Sequencing

1. tickets (service + routes + pages)
2. work orders + transitions + assign (cross-org) + pages
3. inspections, schedules
4. documents hookup for evidence
5. smoke

## 6. Acceptance & smoke

- [ ] Matrix/typecheck/lint green
- [ ] Smoke (the MM story — the point of the slice):
  1. landlord property + ticket (slice 1 data)
  2. MM org `GET /api/properties` → `[]`, ticket list → `[]`
  3. landlord creates WO + `POST /work-orders/[id]/assign` `{assigneeOrganizationId: mmOrg}` (assignee user = MM member)
  4. MM session: `GET /api/work-orders` → **1**; `GET /api/properties` → **1** (arm 4); ticket list → 1 (parent scope)
  5. MM coordinator `PATCH` WO transition → 200; complete → COMPLETED + assignment auto-COMPLETED
  6. MM session without any assignment: still `[]` everywhere
  7. portfolio org PATCH by an unrelated 3rd org → 404
- [ ] UI: board renders, assign dialog lists MM org users correctly (members endpoint filtered by chosen org — **check members API supports cross-org member listing: if `GET /api/members` is own-org only, assign dialog defaults to own-org users and accepts external org id with user picker loaded from… open item: simplest = assignment targets are picked as (org select ← orgs the actor's org has agreements/assignments with + all own-org users) OR free-form: pick org first, then fetch its members via new `GET /api/organizations/[id]/members?for=work-order-assign` guarded by agreement/assignment relationship — decide at build; fallback: assign by email)**
