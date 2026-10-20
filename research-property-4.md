# research-property-4.md — Property sale workflow (incl. land) & cross-org handoff (source of truth)

Series index: 1 (permissions/roles/pages) · 2 (property data model, map pin, platform parity) · 3 (types/ownership/tenants) · **4 (this: sale workflow, land-specific gates, marketing-agent handoff, deal pages).**

Researched from: real-estate sales-cycle literature (Rework 8-stage cycle, Pipedrive 5-stage process, estaleads 5-stage pipeline, Buddle sales workflow chart), sales+lettings platforms (BinaxPay journey), Buildium (leasing-agent commissions), Kenya Ministry of Lands / SDLPP Service Charter / Ardhisasa transfer procedure, Land Control Act (Cap. 302), and `BUILD.md`'s mandated `listing.* / lead.* / handoff.create` keys.

---

## 1. Scope

- One workflow serves **sale of any property type** — a house, an apartment in a multi-owner block, a mall, or **bare land** (research-property-3 §3).
- The **rental letting pipeline** shares the same demand records (leads, viewings) but forks at "application → lease" instead of "offer → deed" (BinaxPay: same demand flow → sale completion *or* tenancy start). Lease side lives in `/leasing` (research-property-1 §4.2); this doc owns `/sales`.
- Marketing-agent orgs (`MARKETING_AGENT` kind) run the top of this pipeline and **hand off** qualified leads cross-org (`handoff.create` — BUILD.md §2.4: "a Phase 2 cross-org domain operation").

---

## 2. Pipeline stages (canonical)

Merged from the researched cycles; each stage has an owner, entry criteria, exit evidence:

| # | Stage | Entry | Exit evidence | Key records touched |
| --- | --- | --- | --- | --- |
| 1 | **Listing prep** | Property marked `forSale`; price research | Listing draft complete: photos, pin, price, legal docs (research-property-2 §5.3) | `Listing(draft)` |
| 2 | **Published / On market** | Owner approves asking price | Listing live (`listing.publish`); syndication later | `Listing(published)` |
| 3 | **Lead capture & qualify** | Enquiry (call/WhatsApp/web/signboard/referral) | Qualified: budget ✓ timeline ✓ criteria ✓ (speed-to-lead < 24h is the top predictor) | `Lead(new → qualified)` |
| 4 | **Match & propose** | Qualified lead | 1..n properties proposed (matching on type/location/price/size) | `Lead → property matches` |
| 5 | **Viewing** | Proposal accepted | Viewing held + structured feedback (interested / to review / declined) | `PropertyViewing` |
| 6 | **Offer & negotiation** | Positive feedback | Offer(s) recorded; counteroffers tracked; price+terms agreed | `Offer(submitted → countered → accepted)` |
| 7 | **Accepted — agreement** | Seller accepts offer | Signed agreement for sale + deposit/booking received | `Offer(accepted)` + documents |
| 8 | **Due diligence / progression** | Agreement signed | Search clean, clearances, consents, valuation, inspection (§4 land checklist) | Deal checklist tasks |
| 9 | **Completion / handover** | Conditions satisfied | Transfer registered, keys/handover, commission settled | `Deal(completed)` + `Listing(sold)` |
| 10 | **Post-sale** | — | Ownership record updated (`ownership.*`), nurture list, report | `PropertyOwnership` |

Reversible/branching: leads can be lost at any stage; listings can be withdrawn; offers rejected/expired; a rejected sale lead can re-enter **letting** (fork). Research benchmarks (funnel metrics for `/reports`): qualification ≥60% of new leads, visit conversion ~40% of qualified, signed ~20% of visits, buyer cycle 60–120 days vs seller cycle 30–90 days.

---

## 3. Data model (proposed records + key fields)

All rows carry `organizationId` + permission gating from research-property-1 §1.6.

### 3.1 `Listing`

| Field | Notes |
| --- | --- |
| `id`, `organizationId`, `propertyId`, `unitId?` | one listing = one property or one unit (mall shop, subdivided plot) |
| `purpose` | `SALE` (this doc) / `RENT` (letting) |
| `title`, `description`, `highlights[]` | listing copy |
| `askingPrice`, `currency` (KES), `priceFrequency` (`TOTAL`/`MONTHLY`/…) | `priceOnRequest` bool |
| `priceHistory[]` | `{ date, price, event: LISTED|REDUCED|INCREASED|WITHDRAWN|SOLD }` (Zillow parity) |
| `status` | `DRAFT → PUBLISHED → UNDER_OFFER → SOLD / WITHDRAWN / EXPIRED` |
| `tenureType` | `FREEHOLD`, `LEASEHOLD`, `SECTIONAL`, … (drives land checklist) |
| `commissionRate` / `commissionBasis` | default terms for the deal |
| `publishedAt`, `sourceChannel` | `DIRECT`/`MARKETING_AGENT`/`IMPORT` |
| `agentAssignments` | `PropertyAgentAssignment` (research-property-1): who markets it, effective dates |
| media | reuses property media + listing-specific shots |

### 3.2 `Lead` (house hunter / buyer — `property.md` §6 `PropertyInterest`)

| Field | Notes |
| --- | --- |
| `displayName`, `phone`, `email`, `preferredChannel` | WhatsApp-first in Kenya |
| `source` | `WEBSITE`, `WHATSAPP`, `REFERRAL`, `SIGNBOARD`, `PORTAL`, `CALL_IN` |
| `budgetMin/Max`, `criteria` (Json: type, beds, locations[], size) | qualification data |
| `status` | `NEW → QUALIFIED → MATCHED → VIEWING → OFFERING → WON → LOST → WITHDRAWN` (+ `rent-forked` when handed to letting) |
| `assignedTo` (staff user) | ownership of follow-up |
| `organizationId` — the org that **captured** it (critical for handoff, §5) |
| `notes`, `nextActionAt` | pipeline discipline (CRM pattern) |
| `propertyInterests[]` | saved interests on specific properties (`PropertyInterest` status: interested → enquiry → viewing → application → converted/withdrawn) |

### 3.3 `PropertyViewing` (`property.md` §6)

`{ orgId, leadId?, propertyId, unitId?, scheduledAt, duration, agentId, status: SCHEDULED|COMPLETED|NO_SHOW|CANCELLED, feedback: INTERESTED|REVIEWING|DECLINED, notes }` — feeds calendar page; reminders are notification-phase work.

### 3.4 `Offer`

| Field | Notes |
| --- | --- |
| `listingId`, `leadId`, `propertyId` | |
| `amount`, `currency`, `terms` (Json: payment plan, contingencies, deposit %) | offers are limited-time (research: offer validity period) |
| `status` | `SUBMITTED → COUNTERED → ACCEPTED / REJECTED / WITHDRAWN / EXPIRED` |
| `counterAmount`, `respondedBy`, `respondedAt` | negotiation history preserved as events, not overwrites |
| `acceptedAt` | triggers deal record |

**Rule (mirror of lease amends):** never overwrite an offer — each counter is a new row/event so negotiation history stays auditable.

### 3.5 `PropertyDeal` (progression room)

`{ orgId, offerId, propertyId, buyerLeadId, status: AGREED → DUE_DILIGENCE → COMPLETION_PENDING → COMPLETED / COLLAPSED, checklist[] (task template + done/owner/due), documents[], completionDate, salePrice, commissionAmount, notes }`.
Checklist template differs by **category** — buildings vs land (§4).

### 3.6 Cross-links

- Completion writes `PropertyOwnership` transfer (new owner party, `startsAt = completion`) — closes the loop with research-property-3 §2.
- `Listing(sold)` feeds price history; property may be archived from active ops or remain (owner changed).
- Audit events for `offer.approve`, `listing.publish`, ownership transfer.

---

## 4. Land sale specifics (the Kenya checklist)

Kenya-specific steps researched from SDLPP Service Charter (2025), Ardhisasa transfer user-guide, Land Control Act/Regulations, and invest-Kenya eProcedures. **Fee figures below are as published in the 2025 service charter — verify current tariffs before surfacing in-product.**

| # | Gate | What's produced | Typical published timing/fee |
| --- | --- | --- | --- |
| 1 | **Official search** | Confirms registered owner, charges/caveats, outstanding rates | search certificate ~1 day |
| 2 | **Title verification** | Title deed copy vs search; mutation/survey plan, beacons | — |
| 3 | **Rates clearance** (county) | Land rates clearance certificate | county-dependent |
| 4 | **Land rent clearance** (registry) | Land rent clearance certificate (leasehold) | online, ~days |
| 5 | **Valuation** | Government valuer's assessment (for stamp duty); private valuation if buyer needs finance | — |
| 6 | **Land Control Board consent** *(agricultural land / controlled transactions)* | LCB consent, Form 1 in triplicate + official search | ~30 days; application fee Kshs 3,000 (special Kshs 10,000) |
| 7 | **Agreement for sale + deposit** | Signed agreement; deposit (commonly 10% on acceptance per charter references) | — |
| 8 | **Stamp duty** | Assessed by Director of Land Valuation; duty paid | as assessed (published tariff varies urban/rural — verify) |
| 9 | **Transfer execution** | Form LRA 33 via **Ardhisasa**: advocate applies → transferor & transferee verify + execute → documents uploaded | registration ~3–7 days; conveyancing fee Kshs 3,000 + registration Kshs 1,000 (charter) |
| 10 | **Spousal/consent where applicable**, PIN/KRA + ID/passport copies + photos | mandatory upload set | — |
| 11 | **Registration & new title** | New title/lease issued to buyer | charter: transfer registration 3 days |
| 12 | **Handover** | Possession, keys/records, ownership record update | — |

Building/apartment sale checklist (lighter): search + rates clearance + **management-corporation/service-charge clearance & NOC** (strata units: outstanding service charge blocks transfer — research-property-3 §2.2), ID/PIN, agreement, transfer, completion.

The `PropertyDeal.checklist[]` renders **category-aware** gates: `LAND` → table above; `RESIDENTIAL/COMMERCIAL` building → the lighter set; all with document upload slots (`document.upload`) and blocking markers (cannot mark COMPLETED while a mandatory gate lacks a document — soft gate in v1, good UX for researchers).

---

## 5. Marketing-agent handoff (cross-org)

BUILD.md: the handoff — a captured tenant/buyer lead passed to a landlord or PM org — is a Phase-2 cross-org operation (`handoff.create`); Phase 1 seeded only the role structure.

| Aspect | Decision |
| --- | --- |
| Who creates | `MARKETING_AGENT` `marketing_agent` role (and PM/landlord `owner`/`leasing_officer` for internal moves) |
| What moves | The **lead + its consent/interest**, NOT raw property data. Receiving org gets name, contact, criteria, source, notes, and the shared listing reference |
| What stays | Capturing org keeps its record; a `Handoff { fromOrgId, toOrgId, leadId, listingId?, status: OFFERED → ACCEPTED → DECLINED → EXPIRED, message, createdAt }` row links them |
| Receiving side | Appears in the **receiving org's** `/sales/leads` inbox; `ACCEPTED` transfers operational ownership (lead `organizationId` re-point or ownership flag — schema decision) |
| Authorization | `handoff.create` on sender; acceptance needs `lead.update` in receiver org; **no permission grants cross-org access by itself** — acceptance creates the relationship, exactly the permission-∧-relationship pattern |
| Property visibility for agents | Agents read **published listing projections** only (research-property-1 §2.4) — full `Property` stays in owner/PM org |
| Audit | Handoff events logged in both orgs |

---

## 6. Roles in this workflow (summary of research-property-1 assignments)

| Actor | Kind | Does |
| --- | --- | --- |
| Marketing agent | MK | Create listings (shared), capture leads, schedule viewings, `handoff.create` |
| Landlord/PM owner | L/PM | Set price, `listing.publish`, `offer.approve` (accept), ownership transfer |
| Leasing officer | PM | Runs letting fork: applications → lease (research-property-1 §2.2) |
| Manager/prop. manager | L/PM | Day-to-day pipeline ops, viewings, negotiation support |
| Finance | PM | Records commission/expense on completion (`expense.create`/`statement.read`) |
| Viewer/auditor | any | Read pipeline + reports |

---

## 7. Sales pages (build list — complements research-property-1 §4.2)

| Route | Content | Gate |
| --- | --- | --- |
| `/sales` | Pipeline board (stages 2–9 as columns/cards), funnel metrics, overdue follow-ups | `listing.list` |
| `/sales/listings` | Listing table: property, purpose, price, status, views/enquiries; **new** button | `listing.list` (`listing.create`) |
| `/sales/listings/[id]` | Listing detail = §5.3 spec + status actions (publish/under-offer/sold/withdraw), price history, assigned agents | `listing.read` (`listing.publish`) |
| `/sales/leads` | Lead inbox: status columns, source, budget, assigned-to, next-action | `lead.list` |
| `/sales/leads/[id]` | Lead profile: contact, criteria, interests, viewings, offers, notes, **handoff button** | `lead.read` (`handoff.create`) |
| `/sales/viewings` | Scheduler + feedback capture (also mirrored on `/calendar`) | `viewing.list` |
| `/sales/offers` | Offer comparison per listing (amount, terms, status timeline) | `offer.list` |
| `/sales/offers/[id]` | Offer detail: counter history, accept/reject (server: `offer.approve`) | `offer.read` |
| `/sales/deals/[id]` | Deal room: category-aware checklist (§4), documents, commission, completion action | `offer.read` + `document.upload` |
| `/sales/handoffs` | Outgoing/incoming handoffs with accept/decline (MARKETING_AGENT + receiver inbox) | `lead.list` / `lead.update` |

Mobile: board collapses to list + swipe status change; viewings/deals reachable from More sheet (nav gating `listing.list` per research-property-1 §4.1).

---

## 8. Reports (funnel)

`/reports` additions (permission: refine `audit.read` or introduce `report.read` later): leads by source, qualification rate, viewings per lead, offers accepted/total, average days lead→accepted, average days accepted→completion, listings by status/price-band, commission accrued (post-completion), handoff acceptance rate. All derived — same principle as `property.md` §7 dashboards.

---

## 9. Open decisions

1. **Lead ownership model on handoff:** re-point `lead.organizationId` (simple) vs immutable capture-org + `Handoff.status` relationship (richer audit). Recommendation: **relationship model** (immutable capture record), receiver gets an org-scoped copy if isolation demands it — settle with schema review.
2. **Deal soft-gate vs hard-gate** on checklist completion — recommend soft (warning) in v1.
3. **Open houses** (Zillow-style events) — defer; viewings cover scheduling.
4. **Syndication/publishing to portals** — external integration, post-phase.
5. **Commission split** (listing agent vs buyer agent vs marketing agent share) — v1 single `commissionAmount` on deal; multi-split later.
