# Slice 5 — Sales (listings, leads, viewings, offers, deals, handoffs)

Models from batch 5. Two audiences: landlord/PM orgs (their own properties + buyers) and MARKETING_AGENT orgs (shared listings, captured leads, handoff out). `PropertyAgentAssignment` rides this slice (property.md §6 — effective-dated agent link).

## 1. Scoping

- **Listing rows**: portfolio side `organizationId = actor.organizationId` (own listings). MK side: listings **shared to them** = `marketingOrganizationId = actor.organizationId` — **read + projection updates only** (decided: MK may edit content fields `title/description/highlights/contact*` and publish? **No — `listing.publish` held by MK marketing_agent per matrix, so MK CAN publish shared listings; price changes (`askingPrice`) = owner-side only? matrix gives MK owner `listing.manage` and agent `listing.publish`. **Decision: MK agent may publish/update content on shared listings (PATCH checks BOTH `marketingOrganizationId = actor.org` and permission); price fields + status SOLD/RENTED/WITHDRAWN restricted to portfolio org server-side (field allowlist per actor side).**
- `ListingPriceHistory`: written automatically whenever `askingPrice`/`priceFrequency` changes (server-side, `event=REDUCED|INCREASED|LISTED`, `changedByUserId=actor`); silent overwrites impossible (no route writes history manually).
- **Leads**: flat capture-org scoping `organizationId = actor.organizationId` (same as tenants). Receiver org reads via `handoffs.some({toOrganizationId: actor.org, status:'ACCEPTED'})` — **the handoff relationship, never a re-point**.
- **Viewings/Offers/Deals**: property children via parent scope (their `organizationId` = portfolio org). But offers on an **MK-shared listing**? Offers live portfolio-side (buyer offers come to owner/PM); MK creates them? matrix: MK marketing_agent has NO offer keys (owner has). So offers = owner-side only; MK lists leads/viewings they created.
  - `PropertyViewing.leadId` may be a lead captured by MK — allowed reference (uuid, no org constraint).
- **Handoff rows**: `fromOrganizationId = actor.org` on create (`handoff.create`); respond requires `toOrganizationId = actor.org` **and** `lead.update` in receiver org (accept implies receiver now sees lead).
- `PropertyDeal`: property child (portfolio scope); buyerOwnerParty must belong to actor's org (`ownership` domain).

## 2. API routes (`lib/domain/sales.ts`, `offer.ts`, `handoff.ts`)

| Method & path | Permission | Rules |
| --- | --- | --- |
| `GET /api/listings` | `listing.list` | `OR: [{organizationId: actor.org}, {marketingOrganizationId: actor.org}]`; includes projection flag `access: 'owner'|'shared'` |
| `POST /api/listings` | `listing.create` | property **must pass `propertyScopeWhere`**; `organizationId` = property's portfolio org (MK can't create for foreign property — they list from shared listings instead; their own-org listings possible for own-org property) |
| `GET /api/listings/[id]` | `listing.read` | either side; **response shaped**: full for owner side; **projection fields only** (strip internal property fields) when `access=shared` |
| `PATCH /api/listings/[id]` | `listing.update` | either side w/ field allowlist (§1); price change → history row in same transaction; `status` transitions via transition map (DRAFT→PUBLISHED via `/publish`; PUBLISHED→UNDER_OFFER auto on offer accept; →SOLD/RENTED via `/close`) |
| `POST /api/listings/[id]/publish` | `listing.publish` | requires lat/lng present (research: pin required to publish) + price or `priceOnRequest`; sets `publishedAt` |
| `POST /api/listings/[id]/close` | `listing.update` | body `{to: SOLD|RENTED|WITHDRAWN|EXPIRED}`; audit |
| `GET/POST /api/listings/[id]/price-history` | `listing.read` / (POST = `listing.update`, same PATCH path handles it — **no separate POST; GET only**) | history list |
| `GET/POST /api/leads` | `lead.list` / `lead.create` | flat capture-org; filters status/source/assignedTo |
| `GET/PATCH /api/leads/[id]` | `lead.read` / `lead.update` | flat own-org, **OR** receiver view via accepted handoff (include `viaHandoffFrom` when matched) |
| `POST /api/leads/[id]/status` | `lead.update` | transition map (NEW→QUALIFIED→MATCHED→VIEWING→OFFERING→WON/LOST…); sets `nextActionAt` guidance |
| `GET/POST /api/viewings` | `viewing.list`/`viewing.create` | parent property scope (own portfolio) **OR** created-by-mine (`agentUserId=actor`)? **rule: property scope OR `organizationId = actor.org`** (MK viewings on shared properties: viewing row org = portfolio org, agent = MK user — MK reaches via `agentUserId`/created row; include `{ organizationId: actor.org }` arm for capture clarity — viewing.organizationId IS portfolio... **decision: viewings scoped `property: scope OR agentUserId = actor.userId OR organizationId = actor.org`** — agent who booked always keeps access) |
| `PATCH /api/viewings/[id]` + `/feedback` | `viewing.update` | status SCHEDULED→COMPLETED/NO_SHOW/CANCELLED; feedback INTERESTED/REVIEWING/DECLINED; updates lead status → VIEWING/OFFERING coherently (best-effort) |
| `GET/POST /api/offers` | `offer.list`/`offer.create` | property scope; `POST` requires listing PUBLISHED/UNDER_OFFER; initial SUBMITTED |
| `POST /api/offers/[id]/counter` | `offer.update` | **new row**: `{amount, terms}` + `supersedesOfferId = id`, old → COUNTERED (transaction) |
| `POST /api/offers/[id]/approve` | `offer.approve` | body `{to: ACCEPTED\|REJECTED}`; ACCEPTED: transaction — offer.acceptedAt, listing.status→UNDER_OFFER, **auto-create `PropertyDeal`** (salePrice=amount, buyerLeadId, checklist template by category) + audit `offer.approve`; only one live accepted offer per listing (conflict → 409) |
| `GET/PATCH /api/deals/[id]` | `offer.read` / `offer.update` | property scope; PATCH = checklist items `{key, done, by, at}`, commissionAmount, notes |
| `POST /api/deals/[id]/complete` | `offer.approve`? — **decision: completion needs `ownership.create`** (it writes the transfer): permissions `['offer.read','ownership.create']` is awkward; **use `ownership.update`** as the permission for the completion action (writes `PropertyOwnership` buyer row + closes seller row + deal.status=COMPLETED + listing→SOLD, audit) |
| `GET/POST /api/handoffs` | `lead.list` (GET, either-side OR) / `handoff.create` (POST) | POST: `fromOrganizationId=actor.org`, `leadId` must be own-org lead, `toOrganizationId` chosen (searchable orgs: orgs with active agreements/assignments with actor's org OR free search by slug — **decision: free org slug search on this endpoint, UI validates preview of target org name**); listingId optional shared listing |
| `POST /api/handoffs/[id]/respond` | `lead.update` | receiver org only; `{to: ACCEPTED\|DECLINED}`; ACCEPTED → receiver now reads lead via relationship; DECLINED/EXPIRED (+ auto-expire job later) |
| `GET /api/agent-assignments` + POST/PATCH (property-level) | `property.read` + `property.update` | `PropertyAgentAssignment`-equivalent: **implemented as `PropertyStaffAssignment` with agent title? Schema has no PropertyAgentAssignment model (deferred). **Decision: v1 skips a separate model — agent linkage = MK listing share (agent org) + per-user `Listing.listedByUserId`/viewing `agentUserId`. Defer dedicated agent-assignment table.** |

## 3. UI pages

| Route | Purpose | Gate | Form |
| --- | --- | --- | --- |
| `/sales` | pipeline overview: stage counters (Listings published, Leads new/viewing/offering, Offers awaiting, Deals in progress) + two lists: active listings, leads needing action (`nextActionAt` ≤ today) | `listing.list` | — |
| `/sales/listings` | table: title, purpose, price, status, access (Mine / Shared-with-me), views placeholder; filters | `listing.list` | — |
| `/sales/listings/new` | `<ListingForm mode="create">` (property picker [scope], purpose, price block, terms, contact) | `listing.create` | **shared** |
| `/sales/listings/[id]` | detail: status actions (Publish/Under-offer via offer flow/Close), price history timeline, offers list (→ offers), viewings, docs (media), shared-access badge + projection banner for MK | `listing.read` | — |
| `/sales/listings/[id]/edit` | `<ListingForm mode="edit">` | `listing.update` | **shared** |
| `/sales/leads` | inbox: status columns/table, source, budget, assigned-to, next action; **Handoff button** on detail only | `lead.list` | — |
| `/sales/leads/new` | `<LeadForm mode="create">` (interest property/listing optional) | `lead.create` | **shared** |
| `/sales/leads/[id]` | profile: contact, criteria, related viewings/offers, status stepper, notes, **Send handoff** (dialog: target org + message), incoming-handoff banner if receiver | `lead.read` | — |
| `/sales/leads/[id]/edit` | `<LeadForm mode="edit">` | `lead.update` | **shared** |
| `/sales/viewings` | scheduler list (date groupings) + feedback capture inline | `viewing.list` | — |
| `/sales/viewings/new` + `/[id]/edit` | shared `ViewingForm` | `viewing.create/update` | **shared** |
| `/sales/offers` | comparison grouped by listing (amount, status, date); create-offer button | `offer.list` | — |
| `/sales/offers/new` | `<OfferForm mode="create">` | `offer.create` | **shared** |
| `/sales/offers/[id]` | detail: terms, counter history chain (supersedes), **Accept/Reject** (dialog, `offer.approve`), link to deal | `offer.read` | — |
| `/sales/deals/[id]` | deal room: checklist (checkboxes, category-aware order for LAND), sale price, commission, documents (entityType=DEAL), **Mark complete** (ownership transfer confirm dialog) | `offer.read` | — |
| `/sales/handoffs` | outgoing (by me) + incoming (to me) tabs; respond Accept/Decline on incoming | `lead.list` / `lead.update` | — |

MK nav: `/sales` visible via `listing.list` (MK holds it) ✓. MK sees shared listings with projection banner.

## 4. Sequencing

1. listings (+price history + publish/close) + pages
2. leads + pages
3. viewings
4. offers + deal auto-create + deal room
5. handoffs (out/in) 
6. smoke

## 5. Acceptance & smoke (the MK cross-org story)

- [ ] Smoke `smoke-sales-e2e.sh`:
  1. landlord lists property → creates listing → publish without pin → 400; with pin → 200, `GET price-history` has LISTED
  2. PATCH askingPrice down → history REDUCED (silent overwrite impossible: raw PATCH price also writes history)
  3. share: `PATCH listing {marketingOrganizationId: mkOrg}` (landlord side) → MK session `GET /api/listings` → 1 with `access:'shared'`; MK `GET /api/listings/[id]` response **excludes** internal fields (assert e.g. no `defaults` key); MK PATCH `title` → 200; MK PATCH `askingPrice` → 400 (field allowlist); MK `GET /api/properties` still `[]`
  4. MK creates lead (own org) → MK `POST /api/handoffs {toOrganizationId: landlord}` → OFFERED; landlord `GET /api/handoffs` shows incoming; landlord `POST respond {ACCEPTED}` → `GET /api/leads/[id]` 200 **in landlord session**; MK lead.organizationId **unchanged** (re-point rule violated → fail)
  5. landlord offer on listing → accept → listing UNDER_OFFER + `PropertyDeal` auto-created; second accept on another offer → 409
  6. deal complete → seller/buyer ownership rows flipped, listing SOLD, audit entries exist
  7. cross-org negatives: unrelated org 404; MK offer create → 403 (no `offer.create`)
- [ ] UI: shared vs mine badge + projection banner; handoff inbox both directions; counter history renders chain
