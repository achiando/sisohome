# Slice 8 — Finances completion: dues & arrears, rent roll, invoices/receipts, adjustments

Builds the missing half of `plan-slice-4-finances.md` (which designed `/finances` but only payments/monthly/receipts-issue shipped under the People plan) plus the user-locked asks of 2026-10-24: **track tenant dues and rents per unit, landlord property per unit, process receipts and invoices linked to property/unit/building with balances, and fix charge corrections**. No new permission keys — everything rides the existing `charge.*`, `adjustment.*`, `payment.*`, `receipt.*` catalog (151 keys unchanged; matrix test must stay green).

## 1. Ledger rules (amended — one balance everywhere)

- **balance = amount − Σ allocations − Σ approved adjustments**, per charge, on EVERY read: `listCharges`, `getCharge`, `unitChargeSummary`, dues, rent roll. (`propertyBalances` already subtracted adjustments; per-row reads did not — that split-brain is the "all are fixed have that" fix.)
- **Overdue = derived**: `postedAt != null && balance > 0 && dueDate < today`. No schema status on Charge; no stored flags anywhere.
- **Aging buckets** by days since `dueDate` of the oldest open charge: `CURRENT` (not yet due) · `0-30` · `31-60` · `61-90` · `90+`.
- **Adjustments**: submit → `PENDING` (`adjustment.create`) → `APPROVED`/`REJECTED` (`adjustment.approve`). Positive amount, all 4 types (CREDIT/WAIVER/REVERSAL/WRITE_OFF) reduce balance when approved — matches `propertyBalances`. Pending/rejected are inert.
- **Void = REVERSAL through approval** (amends plan-slice-4 §2.5's auto-approved idea): the Adjust dialog offers a "Settle full balance" prefill (type REVERSAL, amount = open balance); it then goes through the same approve step. No separate void endpoint.
- **Charges are posted on creation** (existing convention: generation posts directly; manual create posts too). Draft/post workflow from plan-slice-4 stays deferred — `postedAt=null` code paths remain read-only.

## 2. Invoices & receipts (schema)

- **Schema (one column)**: `Charge.invoiceNumber String?` + `@@unique([organizationId, invoiceNumber])` — mirrors Receipt's `(org, number)` pattern; NULLs allowed (legacy rows). `db push` + `generate` + dev-server restart.
- Number: `INV-YYYY-NNNN` per org, count-of-year prefix + 1, retry on P2002 (receipt pattern). **Eager mint** at charge creation (manual + monthly generation); **lazy mint** inside the invoice endpoint for pre-slice rows.
- **Invoice = stateless HTML render** of a charge (no stored document): `GET /api/charges/[id]/invoice` → `{ invoiceNumber, html }` — org header, invoice #, bill-to tenant, property/unit, type/title, period, due date, amount/paid/balance, status chip. Rendered in a sandboxed iframe dialog (agreement-preview pattern).
- **Receipt view**: `GET /api/receipts/[id]` → `{ receipt, html }` (printable RE-YYYY-NNNN receipt: payment method/ref/date, tenant, property/unit, amount). Issuing stays where it is (payments surface → `POST /api/payments/[id]/receipt`).

## 3. Domain (new `dues.ts`, `rent-roll.ts`, `adjustment.ts`; extended `charge.ts`, `monthly.ts`, `receipt.ts`)

### `lib/domain/dues.ts`
- `tenantDues(actor, { propertyId?, unitId?, tenantId?, overdueOnly? })` →
  `{ totals: { outstanding, overdue, dueThisMonth, overdueCount, tenantCount, pendingAdjustments }, rows: DuesRow[] }`
- Rows grouped **tenant × property × currency** from posted open charges (scope: `property: propertyScopeWhere(actor)`; cap 1000 rows ordered dueDate): `{ tenantId, tenantName, propertyId, propertyName, currency, open, overdue, overdueCount, oldestDueDate, ageDays, bucket, chargeCount }`.
- `dueThisMonth` = open charges with `dueDate` within the current calendar month.

### `lib/domain/rent-roll.ts`
- `rentRoll(actor, propertyId)` → `requirePropertyInScope` (404) →
  `{ property, totals, buildings, rows }`
- Row per unit: `{ unitId, unitRef, label?, buildingId, buildingName, occupancy: OCCUPIED|VACANT, tenantId, tenantName, monthlyRent, openBalance, overdueBalance, oldestDueDate, nextDueDate, state }`
  - `state`: `VACANT` (no active lease) · `OVERDUE` (overdueBalance > 0) · `DUE` (open > 0, not overdue) · `PAID` (charges exist, none open) · `NO_CHARGES` (occupied, no posted charges yet).
  - Occupant + rent from ACTIVE/ENDING leases (occupant-map pattern from `unit.ts`); balances from posted charges per unit.
- `buildings`: subtotals `{ buildingId, name, units, occupied, monthlyRent, openBalance, overdueBalance }` (+ a `null` bucket for building-less units); `totals` = grand totals incl. vacant count.

### `lib/domain/adjustment.ts`
- `createAdjustment(actor, { chargeId, type, amount, reason })` — fetch charge → `assertPropertyInScope` (404) → validate enum/amount > 0 (and amount ≤ charge open balance + small epsilon → 400) → create `PENDING` with `propertyId` from the charge, `submittedByUserId` → audit `adjustment.create`.
- `listAdjustments(actor, { propertyId?, status?, chargeId? })` — scope via charge's property; includes charge summary + submitter/approver names.
- `decideAdjustment(actor, id, 'APPROVED'|'REJECTED')` — `PENDING` only (else 409), stamp `approvedByUserId`/`decidedAt`, audit `adjustment.approve|reject`.

### `charge.ts` extensions
- **balance fix**: `listCharges`/`getCharge` include `adjustments: { select: { amount, status } }` → subtract approved; expose `invoiceNumber`, `overdue` (bool), `paidToBalance` unchanged.
- **filters**: `status?: 'open'|'overdue'|'paid'|'all'` (JS-filter after balance — document the take-cap), `dueFrom?`/`dueTo?`.
- `createManualCharge(actor, raw)` — property in scope (404), `unitId ∈ property` (400), tenant/lease coherence light check, chargeType ∈ enum, amount > 0, dueDate required, currency = property default, `postedAt = now`, invoice minted, audit `charge.create`.
- `invoiceCharge(actor, chargeId)` — scope read, lazy-mint number, render HTML (esc()-safe).
- `leaseBalances(actor, leaseIds)` → `Map<leaseId, { open, overdue, currency }>` (for the lease register Balance column).

### `monthly.ts` / `receipt.ts`
- `unitChargeSummary` += `overdue: string` (Σ open where dueDate < today) — consumed by unit Balance cell/card.
- `listReceipts(actor, { propertyId?, unitId?, tenantId?, paymentId?, from?, to? })` — join `payment.property` scope; returns payment context (method/reference/receivedAt) + property/unit/tenant names.
- `getReceipt(actor, id)` — scoped read for the printable view.

## 4. API routes (all `apiRoute`; child mutations = fetch → parent scope → child's own `organizationId`)

| Method & path | Permission | Notes |
| --- | --- | --- |
| `GET /api/dues` | `charge.list` | query: propertyId, unitId, tenantId, overdueOnly → totals + rows |
| `POST /api/charges` | `charge.create` | manual one-off → 201 `{ charge }` |
| `GET /api/charges` | `charge.list` | += `status`, `dueFrom`, `dueTo` query params |
| `GET /api/charges/[id]/invoice` | `charge.read` | → `{ invoiceNumber, html }` (mints lazily) |
| `GET|POST /api/adjustments` | `adjustment.list` / `adjustment.create` | list filters: propertyId, status, chargeId |
| `POST /api/adjustments/[id]/approve` `/reject` | `adjustment.approve` | PENDING → decided (409 otherwise) |
| `GET /api/receipts` | `payment.list` | register with filters above |
| `GET /api/receipts/[id]` | `payment.read` | → `{ receipt, html }` printable |
| `GET /api/properties/[id]/rent-roll` | `charge.list` | rows + building subtotals + totals |
| `GET /api/leases` | `lease.list` | += `showBalance=1` (gated `charge.list` in the route) → `balance {open, overdue, currency}` per row |

## 5. UI

- **`/finances`** (exists in nav with `charge.list`, page never built) — `PageHeader` + `DetailTabs` `?tab=` (page in `<Suspense>`), 5 tabs, each a self-fetching client component:
  1. **Dues** (default): 4 KPI cards (Outstanding / Overdue / Due this month / Pending adjustments) + `ResponsiveDataListing` of dues rows (Tenant, Property, Open, Overdue, Oldest due, Age bucket Badge, N charges; row → `/people/tenants/[id]`), property filter + "Overdue only" toggle.
  2. **Charges**: register (`ResponsiveDataListing`) — Invoice # (click → invoice dialog), title/type, property + unit, tenant, due date + `OVERDUE` badge, amount, paid, balance, status chip. Filters: property, status chips (All/Open/Overdue/Paid). Row actions: Record payment, Adjust, Invoice. Primary: **New charge** (`charge.create` → `ChargeDialog`).
  3. **Payments**: existing `GET /api/payments` register (breakdown tiles + list), primary **Record payment** (property-required), row action **Issue receipt** (`receipt.issue`) + View.
  4. **Receipts**: `GET /api/receipts` register; row action **View** → receipt iframe dialog (print button inside).
  5. **Adjustments**: queue (PENDING first, status chips) + primary **New adjustment** (charge picker: property → open charges w/ live balance; type; amount ≤ balance with "full balance" helper; reason) + row actions Approve/Reject (`adjustment.approve`).
- **Shared dialogs** under `finances/_components/`: `charge-dialog.tsx` (property → unit/tenant cascade via `/api/properties`+`/api/tenants`+`/api/units` fetches like existing forms), `adjustment-dialog.tsx`, `invoice-dialog.tsx` (sandboxed iframe), `receipt-dialog.tsx` (sandboxed iframe).
- **Property detail**: new **Rent roll** tab (before Report, gated `charge.list`) — `RentRollTab`: totals strip, building-grouped table with per-building subtotal rows (units, occupied, rent roll, open, overdue) + grand total, state badges (VACANT/OVERDUE/DUE/PAID/NO_CHARGES), row → unit detail.
- **Overdue flags on existing surfaces**:
  - Unit registers' Balance cell: add `Overdue Xd` red line (`unitChargeSummary.overdue` + max age) — `unit-columns.tsx`.
  - `UnitBalanceCard`: per-row overdue badge + overdue subtotal in header.
  - Leases register: new **Balance** column (open/overdue amber/red) via `showBalance` + `leaseBalances` (mirrors the units pattern; hidden without `charge.list`).
- **Lease detail**: new **Charges** tab (`listCharges?leaseId=` — open balance strip + table + Record payment button).
- **Bills edit**: `UnitBillsCard` gains Edit dialog → `PATCH /api/charge-schedules/[id]` (API exists, UI missing).
- `humanizeAction` += `charge.create`, `adjustment.create|approve|reject`, `receipt.issue` labels.

## 6. Sequencing

1. Schema (`invoiceNumber`) → db push → generate → **restart dev server**.
2. Domain: charge.ts balance fix + filters + manual create + invoice + leaseBalances → dues → rent-roll → adjustment → receipt list/get → unitChargeSummary.overdue.
3. Routes (10 above) — all 401 unauthed.
4. UI: `/finances` shell + 5 tabs → property Rent roll tab → overdue flags + lease Balance column + lease Charges tab → bill edit dialog → humanizeAction.
5. `smoke-finances.ts` + regressions (payments 51, monthly 62, leasing 82, people-quick 32, units 42).
6. Gates + STATUS.

## 7. Acceptance & smoke checklist (`apps/web/scripts/smoke-finances.ts`)

- [ ] **Balance fix**: charge with allocation + APPROVED adjustment → `listCharges.balance` = amount − allocated − adjustment; PENDING adjustment → balance unchanged.
- [ ] **Manual charge**: create (201, posted, `INV-YYYY-NNNN` minted, audit row); cross-property unit → 400; stranger property → 404; bad type/amount → 400.
- [ ] **Invoice**: endpoint returns html incl. number + balance; legacy charge (no number) mints lazily; second fetch → same number; stranger → 404.
- [ ] **Dues**: seed unit charge due in the past, partial pay → row shows open/overdue/age bucket; KPI totals math-check; `overdueOnly` filters; scope 404s.
- [ ] **Adjustments**: create PENDING (audit) → balance unchanged everywhere → approve → balance drops in listCharges + dues + `propertyBalances` → double-decide → 409; amount > balance → 400; REJECTED inert; stranger 404.
- [ ] **Rent roll**: occupied + vacant rows, overdue state after past-due charge, building subtotals sum to totals, stranger property → 404.
- [ ] **Receipts**: register lists issued receipt with payment/tenant/property context; `GET /api/receipts/[id]` html incl. `RE-` number; stranger → 404.
- [ ] **Lease balances**: `GET /api/leases?showBalance=1` → open/overdue per lease; without permission → no balance field.
- [ ] **Overdue unit summary**: `unitChargeSummary` overdue field only counts past-due open charges.
- [ ] Cleanup: full residue removal (charges, adjustments, receipts, payments, leases, tenants, property, org, users).
