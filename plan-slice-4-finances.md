# Slice 4 — Finances (charge schedules, charges, payments, allocations, adjustments, receipts, statements)

The **rental-collection slice** (see agreed flow: ChargeSchedule → draft Charge → post → Payment → Allocation → derived balance → Adjustment → Receipt/Statement). Models from batch 3. Ledger money rows are property children (`organizationId` = portfolio org) — scope through parent property, per index §B.

## 1. Ledger rules (from property.md §4 + index decisions)

- **Balance is derived** — never stored, never returned as authoritative field: `charge.balance = amount − Σallocations ± Σapproved adjustments` computed per charge on read.
- `postedAt=null` = draft (editable, `charge.update`); posting = `charge.approve` → collectable, immutable except `charge.manage` void.
- Allocating does NOT mutate the charge; partial/multi/unallocated all legal; over-allocation → 400.
- Submit ≠ approve: finance_officer creates/updates, finance_approver (or owner/prop_mgr per matrix) approves; **service checks the two permissions are absent together?** No — enforced by keys: `expense.approve`/`adjustment.approve`/`charge.approve` routes carry those permissions, `create` routes carry the create keys. A role holding both is legitimate (owner).
- Adjustments affect balance only when APPROVED; REJECTED rows are inert.
- Approval on **portfolio org rows by a PM finance_approver**: PM reaches the charge through parent scope — but the charge's own `organizationId` is the portfolio org ≠ PM org. Mutation pattern: fetch → `assertPropertyInScope` (agreement arm) → `updateMany({ where: { id, organizationId: portfolioOrg } })` (child's own org) ✓.

## 2. API routes (`lib/domain/finance.ts` or split `charge.ts`/`payment.ts`)

### 2.1 Charge schedules (recurring rules)

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/charge-schedules` | `charge.list` | parent scope; filters active/lease/property |
| `POST /api/charge-schedules` | `charge.create` | exactly ONE scope target (lease \| property \| unit) → 400 else; `organizationId`=portfolio org; `nextRunAt` computed; validate lease/property/unit coherence (unit ∈ property) |
| `PATCH /api/charge-schedules/[id]` | `charge.update` | fetch→scope→update; never edits charges already generated (comment + no-op) |
| `POST /api/charge-schedules/[id]/pause` + `/resume` | `charge.update` | `isActive` toggle |
| `POST /api/charge-schedules/run` | `charge.create` | **generator**: body `{ asOf?, leaseId?, propertyId? }` — for each ACTIVE schedule due (`nextRunAt ≤ asOf`): create DRAFT `Charge` (billingPeriod from frequency, `dueDate` from lease dueDay/property config, amount, `scheduleId` trace), advance `nextRunAt`/`lastRunAt`; idempotency guard: skip if a charge with same scheduleId+period exists (unique-ish check in transaction); returns `{created: n}`. Callable manually now; cron later |

### 2.2 Charges

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/charges` | `charge.list` | parent scope (+ tenant/lease filters); **include computed `balance`, `allocatedTotal`** (sum allocations + approved adjustments) |
| `GET /api/charges/[id]` | `charge.read` | scope + allocations + adjustments + payments |
| `POST /api/charges` | `charge.create` | one-off manual charge; DRAFT by default, `post: true` allowed only with `charge.approve` in session (check via permissions arg = `[ 'charge.create', 'charge.approve' ]`? — **no**: single route with `charge.create`; posting is separate endpoint) |
| `PATCH /api/charges/[id]` | `charge.update` | **draft only** (`postedAt=null`) → 409 if posted |
| `POST /api/charges/[id]/post` | `charge.approve` | sets `postedAt`; transition guard |
| `POST /api/charges/[id]/void` | `charge.manage` | posted charge → audit + balance excluded? **decision: void sets `postedAt` kept but adds a compensating adjustment auto-created (type REVERSAL, status APPROVED)?** Simpler v1: void = status-less flag `notes` + excluded from statements via `voidedAt` column? **No new columns in this wave** — v1 decision: voiding posts an auto `FinancialAdjustment(REVERSAL, APPROVED)` equal to remaining balance + audit; original charge stays. If that proves clumsy, revisit after build. |
| `POST /api/charge-schedules/[id]/generate` | covered by run endpoint | — |

### 2.3 Payments & allocations

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/payments` | `payment.list` | parent scope; filters method/date/reference |
| `POST /api/payments` | `payment.create` | `organizationId`=portfolio org; `receivedByUserId=actor.userId`; reference uniqueness per org loose (warn only); tenantId/leaseId coherence check (party of that lease → 400 otherwise) |
| `GET /api/payments/[id]` | `payment.read` | scope + allocations + receipts |
| `PATCH /api/payments/[id]` | `payment.update` | notes/reference only; amount change after allocation → 409 if any allocation exists |
| `POST /api/payments/[id]/reconcile` | `payment.manage` | `reconciledAt/by` |
| `GET /api/payments/[id]/allocatable-charges` | `charge.list` | open charges for that tenant/lease/property sorted dueDate (allocation workspace support) |
| `POST /api/payments/[id]/allocations` | `payment.create` | body `{ items: [{ chargeId, amount }] }`; transaction: validate all charges in parent scope + same tenant context, Σ ≤ payment.amount, charge posted → else 400; creates rows; **payment fully allocated → nothing else** (no auto status) |
| `DELETE /api/allocations/[id]` | `payment.update` | fetch→parent scope→delete (un-allocate); audit |
| `POST /api/payments/[id]/receipt` | `receipt.issue` | creates `Receipt` (number = per-org sequence: `RE-YYYY-NNNN` from count+1 in transaction w/ retry on unique conflict); `issuedByUserId=actor` |

### 2.4 Adjustments, statements, overview

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/adjustments` | `adjustment.list` | parent scope; status filter |
| `POST /api/adjustments` | `adjustment.create` | `submittedByUserId=actor`, status PENDING; amount sign per type (credit negative) |
| `POST /api/adjustments/[id]/approve` / `/reject` | `adjustment.approve` | sets status + `approvedByUserId` + `decidedAt`; approver ≠ submitter enforced? **keys only** (decision 6: enforce by keys — owner may self-approve; matrix already separates finance roles) |
| `GET /api/statements?ownerPartyId=&propertyId=&from=&to=` | `statement.read` | computed rollup: billed, collected, adjustments, outstanding per property/owner (charges/payments/allocations/ownerships in range) — no stored rows |
| `GET /api/finances/overview` | `charge.list` | `{ billed, collected, outstanding, overdueCount, byStatus… }` for scope; drives `/finances` + Overview KPIs (slice 6 consumes) |

## 3. UI pages

| Route | Purpose | Gate | Form |
| --- | --- | --- | --- |
| `/finances` | KPI cards (billed vs collected, outstanding, overdue count) + recent payments + pending approvals shortcut | `charge.list` | — |
| `/finances/charges` | register: status chips (Draft/Posted), balance column, due-date aging; row actions: **Post** (`charge.approve`), Void (`charge.manage`), view | `charge.list` | — |
| `/finances/charges/new` | `<ChargeForm mode="create">` (property → tenant/lease picker, type, amount, due date) | `charge.create` | **shared** |
| `/finances/charges/[id]` | detail: source trace (schedule/lease link), allocations timeline, adjustments, balance math displayed | `charge.read` | — |
| `/finances/charges/[id]/edit` | `<ChargeForm mode="edit">` (draft only; server 409 surfaced) | `charge.update` | **shared** |
| `/finances/payments` | list + **Record payment** primary | `payment.list` | — |
| `/finances/payments/new` | `<PaymentForm mode="create">` | `payment.create` | **shared** |
| `/finances/payments/[id]` | detail + **allocation workspace**: allocatable-charge table w/ per-row amount inputs, allocated badge, save allocation; Issue receipt button; reconcile | `payment.read` (+create/update for actions) | — |
| `/finances/adjustments` | queue: PENDING prominent; Approve/Reject buttons (`adjustment.approve`); create form | `adjustment.list` | — |
| `/finances/adjustments/new` | `<AdjustmentForm mode="create">` (charge picker w/ live balance) | `adjustment.create` | **shared** |
| `/finances/statements` | owner/property/date pick → computed statement table + print view (client) | `statement.read` | — |
| Schedules management | on lease detail (slice 2 "Charge rules" tab) + property Management tab: list `charge-schedules`, pause/resume, **Run billing** button (`POST /run` with progress toast) | `charge.list/create` | `ScheduleForm` dialog |

## 4. Sequencing

1. charge-schedules + generator (leases get auto-charges — test with slice-2 lease)
2. charges (list/detail/post/void) + overview endpoint
3. payments + allocation workspace + receipts
4. adjustments + statements
5. lease/property tabs hookup (charges on lease detail)
6. smoke

## 5. Acceptance & smoke (the full collection cycle)

- [ ] Smoke script `smoke-finance-e2e.sh`:
  1. seed slice-1 property + unit + slice-2 active lease
  2. `POST /charge-schedules` (rent rule, lease scope) → `POST /run` → draft charge created, `nextRunAt` advanced, second `POST /run` → 0 new (idempotent)
  3. `POST /charges/[id]/post` by finance_officer-key session → 200; `PATCH` posted → 409
  4. `POST /payments` (M-PESA) → allocate PARTIAL → charge balance = remainder (GET shows computed)
  5. over-allocate → 400; `POST /receipts` → number issued; second receipt same number conflict handled
  6. finance_approver session: `POST /adjustments` (create) → 403 (`adjustment.create` absent!) — **correct separation**; officer creates, approver approves → balance drops
  7. `GET /statements` totals math-check vs charges/payments
  8. PM org (agreement active): charges visible via parent scope; PM finance_officer posts a portfolio-org charge → 200 (mutation uses child org id after scope assert)
  9. unrelated org → 404 everywhere
- [ ] UI: allocation workspace supports partial + multi + leave-unallocated; void explains auto-reversal; viewer role sees read-only (no action buttons)
