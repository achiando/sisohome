# Roadmap — gap closure after Sales Slice 5

**Status:** approved 2026-10-27 · phases run **in order** · one `feat` + `docs: STATUS`
commit pair per phase · gates per phase = typecheck 10/10 · lint 0 errors vs
baselines · matrix guard 0 new keys · named smoke + named regressions.
No `pnpm build`. `apiRoute` on every org-scoped route; permission keys drawn
only from the existing 151.

**Context:** Phases 0–9 of the property system are built and committed
(`68c6fc4` = sales slice 5). The audit found: no payment-collection
automation, signed contracts discarded after hashing, three dead nav
entries, no web unit tests. This roadmap closes those in priority order.

## Locked decisions (user, 2026-10-27)

1. **M-Pesa import = preview-then-commit.** Nothing hits the ledger without
   a confirm click; exact matches are pre-checked in the preview.
2. **Signed contracts = store rendered HTML in the DB** at sign time.
   Reverses the earlier evidence-only decision (hash + pointer, HTML
   discarded) — STATUS must record the reversal when shipped.
3. **Calendar = landlord-attention calendar** — "anything that needs the
   landlord to be around": viewings, vacant units, lease ends (upcoming
   vacancies), scheduled work orders/inspections, recurring-task due dates.
   Supersedes the viewings-only scope in `plan-slice-6-cross-cutting.md`.
4. **Payment ingestion is source-abstraction-first** so a future Daraja /
   bank-CSV / card gateway drops in with zero pipeline changes.
5. **Unit tests: deferred to the last phase** (Phase 6) per user.

---

## Phase 0 — DB unblock + Slice 5 verification
*~~Prerequisite (~0.5 day). Blocked on the user lifting the Prisma account
`planLimitReached` restriction (STATUS §5 blocker #7).~~*

**✅ DONE 2026-10-31** — `DATABASE_URL` switched to a new PostgreSQL
database (Neon); blocker #7 retired. `smoke-sales` **77/77** · regressions
finances **135** / payments **51** / monthly **62** / leasing **82** /
people-quick **32** / units **42** (all at baseline) · `smoke-portal-e2e.sh`
**ALL PASS (9 steps)** · 18 sales routes → 27 method-endpoints all **401**
unauth · typecheck 10/10 · lint 0 errors vs baselines · matrix guard ✓.
Fixes en route (recorded in STATUS §3 Roadmap Phase 0): lead guidance-bump
now follows `LEAD_STAGE_ORDER`; lead-detail page reads the nested
`data.lead.viewings/offers/handoffs` contract; `smoke-monthly` day-31
`setMonth` rollover; new `scripts/lib/ensure-other-org.ts` second-org
fixture wired into all 12 `otherOrg` smokes (fresh single-org seeds were
silently skipping stranger checks below baseline).

- Run `apps/web/scripts/smoke-sales.ts` (acceptance 1–7: price history on
  create/change/close, publish gates, MK shared projection content-only,
  offer accept → auto-deal → 409 second accept, completion ownership flip,
  handoff lifecycle incl. declined-receiver 404 + re-point rule). Fix any
  failures.
- Regressions: finances **135** · payments **51** · monthly **62** ·
  leasing **82** · people-quick **32** · units **42** ·
  `smoke-portal-e2e.sh` ALL PASS.
- 401 checks on the 18 new sales routes (fresh dev server).
- STATUS: flip the Slice 5 block to verified; clear blocker #7.

**Gate:** all green → Phase 1. A failure here blocks everything downstream.

## Phase 1 — M-Pesa message import + payment-source abstraction
*Highest business value (~2–3 days).*

Goal: landlord pastes a batch of M-Pesa SMS confirmations → parsed →
auto-matched to tenants/open charges → preview table → one-click commit
creates payments + allocations.

### Schema (additive; zero new permission keys)

- `Payment.externalId String?` — per-org-unique receipt dedupe (M-Pesa code).
- `Payment.source String @default("MANUAL")` — MANUAL | IMPORT | GATEWAY
  (future gateway rows self-identify).
- `PaymentImportBatch` — id, organizationId, source, rawText, importedByUserId,
  appliedAt?, createdAt.
- `PaymentImportRow` — batchId, raw line, amount, currency, reference,
  externalId, senderPhone, paidAt, status
  (`PARSED | MATCHED | AMBIGUOUS | UNMATCHED | DUPLICATE | APPLIED`),
  matchedTenantId/leaseId/unitId?, paymentId?, confidence Int.

### Abstraction — `lib/payments/adapter.ts`

```ts
interface PaymentSourceAdapter {
  id: string                       // 'mpesa-sms' | 'daraja' | 'bank-csv' ...
  label: string
  parse(raw: string): ParsedPayment[]
}
type ParsedPayment = {
  amount: number; currency: string; reference?: string
  externalId?: string;             // M-Pesa receipt code
  senderPhone?: string; paidAt?: string; raw: string
}
```

Registry `PAYMENT_SOURCES`; first adapter `mpesa-sms.ts` parsing the
Safaricom confirmation format (receipt code, `Ksh` amount with commas,
account field, date/time, `254…` sender, "Confirmed." prefix). Multiple
messages per paste split on line/`Confirmed.` boundaries. Future Daraja
webhook / bank-CSV implement the same interface and share the
match → record pipeline unchanged.

### Matcher — `lib/domain/payment-import.ts`

- Signals: sender phone → tenant phone · account text → unitRef/lease ref ·
  amount vs open charge balance · externalId/reference dedupe against
  `Payment` + `PaymentClaim`.
- Confidence: phone+amount exact → pre-checked; single signal → needs a
  glance (AMBIGUOUS); none → UNMATCHED with manual tenant picker.
- Commit reuses the claim-confirm allocation path
  (`recordMultiMonthPayment`), stamps `externalId` + `source: 'IMPORT'`,
  writes `payment.import` audit rows.

### Routes

- `POST /api/payments/import/preview` (`payment.create`) — parse + match,
  **no writes**.
- `POST /api/payments/import/commit` (`payment.create`) — body
  `{ batchIndex decisions[] }`; persists batch/rows, applies checked rows.
- `GET /api/payments/imports` (`payment.list`) — recent batch history.

### UI

Finances → Payments tab → **Import M-Pesa messages** dialog: paste textarea →
preview table (amount/ref/date/sender, matched tenant, confidence chip,
checkbox, per-row tenant select for unmatched) → Commit → summary toast
(N applied / M unmatched) → register refresh.

### Smoke — `scripts/smoke-payments-import.ts`

Parse variants (comma amounts, dates, account) · phone+amount auto-match ·
re-import same batch → all DUPLICATE · allocation + balance drop correctness
· unmatched isolation · cross-tenant phone isolation · audit rows.
Gates: typecheck · lint · matrix (0 new keys) · payments regression **51**.

## Phase 2 — Signed contracts stored as documents
*(~1–2 days)*

Goal: every signed lease/agreement keeps the full contract, retrievable
forever.

- **Schema:** `DocumentVersion.htmlContent Text?` (additive).
- At sign time, inside the approve transaction: create `PropertyDocument`
  (entityType LEASE | AGREEMENT, kind TENANCY_AGREEMENT | CONTRACT) +
  baseline `DocumentVersion` carrying the signed HTML. The sha256 caption
  is kept and now verifies against stored content.
- `GET /api/documents/[id]/download` serves the HTML as an attachment when
  `htmlContent` is present (falls back to `storageKey` URL otherwise).
- Portal tenant **Documents** page picks the contract up via existing LEASE
  scoping (verify explicitly).
- Lease detail + agreement detail gain a **Signed contract** card
  (view in new tab + download).
- STATUS records that this reverses the evidence-only decision.

**Smoke:** extend `smoke-agreement-sign` (121 baseline) — document exists
after approve, hash matches stored HTML, portal lists it, download 200,
cross-org 404. Regression: leasing **82**.

## Phase 3 — Landlord-attention calendar
*(~2 days; kills dead nav entry #1)*

- `GET /api/calendar?from=&to=` — any authenticated member; per-domain row
  scopes (viewings/leases/WOs/inspections each keep their own scope rules;
  MM sees only assigned/agreement properties).
  Events:
  - viewings — `PropertyViewing.scheduledAt` (SCHEDULED/CONFIRMED)
  - lease ends — `Lease.endsAt` (ACTIVE/ENDING → "vacancy coming")
  - work orders — `WorkOrder.scheduledFor` (open)
  - inspections — `PropertyInspection.scheduledFor` (open)
  - recurring tasks — `RecurringSchedule.nextDueAt` (open)
  - vacant-unit markers — derived, units currently VACANT (all-day style)
  - Each event: `{ kind, id, date, title, propertyId, unitId?, href }`
- `/calendar` page: **month grid, no calendar library** (date-cell event
  dots) + agenda toggle + vacant-units panel; click-through to entity.

**Smoke:** mixed events render · date-range filter · MM scoping.

## Phase 4 — Documents library page
*(~1 day; dead nav entry #2)*

- `/documents`: org-wide list over existing `GET /api/documents`,
  entity-type + kind filters, search → entity detail. Phase-2 signed
  contracts become browsable here.

**Smoke:** list + filters + cross-kind isolation.

## Phase 5 — Thin reports
*(~1–2 days; dead nav entry #3)*

- `GET /api/reports/summary` (gate `audit.read`): occupancy, dues aging,
  month payments, open tickets, live listings → `/reports` page: summary
  cards + CSV deep-links. Full owner P&L is a later phase.

**Smoke:** summary numbers cross-check against direct list endpoints for the
same session; MM aggregate-only (no `tenant.read` leakage); dead-nav check
on all four org kinds.

## Phase 6 — Unit tests *(deferred by user; planned)*

- vitest in `apps/web`, pure-logic first: payment matching, allocation
  math, lease overlap guard, status-transition maps, deal checklist
  template — so QA stops being hostage to the live DB.

---

## Conventions (every phase)

- Gates: `pnpm typecheck` (10/10) · `pnpm lint` 0 errors vs baselines
  (web 8, ui 48, welding 26, auth-ui 5, diy 5, admin 3) ·
  `packages/database` matrix guard · per-file eslint on new files.
- Per-phase smoke + named regressions; dev server restart after
  `prisma generate`; new routes 401-checked unauthed.
- Commit pair: `feat(web): …` then `docs: STATUS …` (never pushed unless
  asked).
- `plan-slice-6-cross-cutting.md` is **superseded** by Phases 3–5 for
  calendar/documents/reports scope (its Overview-KPI piece folds into
  Phase 5).

**Total estimate: ~8–11 days.** Phase 1 alone replaces most daily manual
reconciliation; Phases 3–5 make the nav honest in one coherent block.
