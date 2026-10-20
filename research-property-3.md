# research-property-3.md — Property types, multi-owner models & tenant management (source of truth)

Series index: 1 (permissions/roles/pages) · 2 (property data model, map pin, platform parity) · **3 (this: type taxonomy, ownership patterns incl. malls & multi-owner apartments, tenant management)** · 4 (sale workflow).
Answers the mandate: *manage every property type — malls, apartments with different owners, land — with each clearly indicated; build tenant management around the tenant.*

---

## 1. Property type taxonomy (the controlled vocabulary)

Two-level: `category` (grouping/reporting) + `propertyType` (granular). Aligned to what BuyRentKenya/Jumuika expose and what Buildium/Yardi-style products segment on.

### 1.1 Level 1 — `category`

| Value | Label | Notes |
| --- | --- | --- |
| `RESIDENTIAL` | Residential | Homes people live in |
| `LAND` | Land | Plots/farms — no building required; lease layer optional |
| `COMMERCIAL` | Commercial | Business premises: retail, office, mall |
| `INDUSTRIAL` | Industrial | Warehouses, factories, yards |
| `MIXED_USE` | Mixed-use | One property, multiple categories (retail + residential…) |
| `SPECIAL` | Special purpose | Institutional/leisure: hospital/clinic, school, church, hotel, petrol station, parking structure |

### 1.2 Level 2 — `propertyType` (per category)

| Category | `propertyType` values | Typical unit types |
| --- | --- | --- |
| RESIDENTIAL | `APARTMENT_BLOCK`, `APARTMENT`, `HOUSE`, `TOWNHOUSE`, `VILLA`, `MAISONETTE`, `BEDSITTER`, `SERVICED_APARTMENT`, `GUEST_HOUSE`, `STUDENT_HOUSING`, `RETIREMENT_HOME` | Studio/bedsitter/1–4BR/maisonette |
| LAND | `RESIDENTIAL_PLOT`, `COMMERCIAL_PLOT`, `AGRICULTURAL_LAND`, `INDUSTRIAL_PLOT`, `MIXED_PLOT`, `FARM` | Usually none (or `PLOT` units after subdivision) |
| COMMERCIAL | `OFFICE_BUILDING`, `RETAIL_SHOP`, `MALL`, `STRIP_CENTER`, `RESTAURANT`, `BANK_BRANCH`, `MIXED_COMMERCIAL` | Shop, office, floor, kiosk, anchor space |
| INDUSTRIAL | `WAREHOUSE`, `FACTORY`, `WORKSHOP`, `YARD`, `SILO` | Warehouse bay, factory floor, yard slot |
| MIXED_USE | (any combo — category is `MIXED_USE`, subtypes listed on the record) | Mixed |
| SPECIAL | `HOTEL`, `HOSPITAL`, `SCHOOL`, `CHURCH`, `PETROL_STATION`, `PARKING_GARAGE`, `STORAGE_FACILITY` | Varies |

Parity checks: BuyRentKenya tree = Apartments/Houses/Villas/Townhouses/Bedsitters/Land(Residential+Commercial)/Commercial(Offices+Shops+Warehouses) ✓ · Buildium markets = Residential/Multifamily/Single-family/Commercial/Student/Mixed-use/Community-association ✓ · Zillow home types include Lots-Land & Apartments ✓.

### 1.3 Behavior matrix — what changes per type

This is the "clearly indicated" spec: the UI and rules must visibly branch on type.

| Concern | Residential | Land | Mall / retail center | Office / commercial | Mixed-use |
| --- | --- | --- | --- | --- | --- |
| Buildings/units | Yes (or single unit) | No (or plot units post-subdivision) | Yes: floors → shops/kiosks/parking | Yes: floors → suites | Combination |
| Lease granularity | 1 unit ↔ 1 lease (multi-unit rare) | Lease rare (license/lease of ground) | **Per-shop leases**, anchor vs small shop, short-term licenses (kiosks/ATMs) | Per-suite; floor plates can subdivide | Per-space |
| Rent structure | Flat monthly | — | **Base rent + turnover/percentage rent** + service charge (CAM) | Gross / NNN / stepped rent | Varies by space |
| Service charge | Optional (apartment blocks) | — | **CAM**: cleaning, security, HVAC, lifts, marketing fund — reconciled annually (ICSC CAM practice: estimate monthly, reconcile yearly) | NNN recoveries | Varies |
| Key metric | Occupancy, arrears | — | **GLA, % leased/occupied, sales per m², footfall, anchor vs small-shop split** (Kimco/Brixmor disclosures) | NLA, % leased, rent/sqft | Blended |
| Utilities | Per-unit meters or included | Water/power availability flags | Common-area meters + tenant submeters; shared allocation | Submetered floors | Varies |
| Unit defaults | Rent, deposit, frequency | — | Area (m²), base rent per m², turnover % threshold | Rent per m² | Varies |
| Vacancy handling | Advertise → applications | Advertise → sale pipeline (research-4) | Leasing pipeline + stacking plan; **co-tenancy** effects | Leasing pipeline | Varies |
| Extra docs | Tenancy agreement, ID, deposit receipt | Title deed, search, survey/beacons, PPA2, LCB consent | Fit-out rules, turnover reports, CAM schedule | Fit-out/SNAG, service contract | Mixed |
| Deposit treatment | Security deposit (1–3 months, `property.md` deposit terms) | Booking deposit / 10% (sale) | Fit-out deposit + rent deposit | Rent deposit + fit-out | Varies |

Implementation implication: type-specific behavior rides on `category`/`propertyType` + `attributes Json` (research-property-2 §5.1) — **no separate tables per type**. The lease model already supports unit-specific rent (`LeaseUnit`), so turnover rent = an additional `LeaseChargeRule`/charge source rather than a new lease family (design confirmation lands with `property.md` financial policy).

---

## 2. Ownership models — one property, many shapes

Ownership is modeled **separately from the managing organization** (`property.md` §1: ownership/org/auth live outside the property design; foundation reserves `ResourceRelationship` for owner↔property↔management links; BUILD.md Phase 2 includes `PropertyOwnership` + `PropertyManagementAgreement`).

### 2.1 The four real-world shapes to support

| # | Shape | Description | How it maps |
| --- | --- | --- | --- |
| **A** | Self-managed landlord | Org = owner; owns 1..n properties | `PropertyOwnership(ownerParty → org itself or person)`; access via org membership |
| **B** | Multi-property investor / company | Several owners **within one org** (family, syndicate, REIT) | Multiple `PropertyOwnership` rows; optional `sharePercent`; owners may be org members **or** external parties with future portal access |
| **C** | Property-management company | PM org operates **other owners'** assets | `PropertyManagementAgreement(organizationId = PM, propertyId, ownerPartyId, startsAt, endsAt, status)`. **Acceptance criterion (BUILD.md): PM accesses only properties under a valid agreement** |
| **D** | **Multi-owner building** — apartment block / mall where units have *different owners* | Sectional title / strata: each unit individually titled; common property co-owned | **Unit-level `PropertyOwnership`** (owner attached to `unitId`, not just `propertyId`) + management corporation (§2.2) |

A single property may combine C+D: a PM company contracted by a strata management corporation to run a mall where every shop has a different owner.

### 2.2 Multi-owner apartment (Kenya Sectional Properties Act — researched)

Facts (Kenya: Sectional Properties Act 1987 + Sectional Properties Act 2020 regime; FIG paper on registration of strata in Kenya; Kenyan strata-management guides):

- Owner holds a **sectional title to their individual unit** (unit no., floor area, **unit factor/share**); common property (structure, roof, lifts, corridors, drainage, parking, grounds) is co-owned by all unit owners **in proportion to unit factor**.
- A **Management Corporation** is constituted automatically on registration of the sectional plan — members = all unit owners; it manages common property, collects **service charges**, insures, enforces rules; governed by an elected committee via AGM.
- Service charges are calculated by **unit-entitlement share** (cf. Australian CSLE lot entitlements / NZ body-corporate levies: annual budget ÷ unit-entitlement share; special levies for one-off projects; sinking/reserve fund for major repairs).
- Arrears of service charge can be recovered with legal mechanisms (liens against the unit in Kenya) and block unit sales.

**Model decisions:**

| Concept | Record |
| --- | --- |
| Unit owner | `PropertyOwnership { organizationId, propertyId?, unitId?, ownerPartyId, sharePercent/unitFactor, startsAt, endsAt, titleNumber? }` — **`unitId` nullable → covers both whole-property and per-unit ownership** |
| Owner party | `OwnerParty` (person or company; KRA PIN, contact, address) — may later link to `User` for owner portal |
| Management corporation / body corporate | Represented as the **owner side** of the management agreement (an `OwnerParty` of type `ASSOCIATION`) — no new auth system |
| Service charge | A `ChargeSchedule`/recurring charge at **unit level** with basis `UNIT_ENTITLEMENT` share of the property's budget — reuse ledger (`property.md` §4) instead of a parallel balance system |
| Governance events (AGM, committee) | Out of scope v1; keep `notes`/documents only |

### 2.3 Mall specifics (single-owner vs strata mall)

- **Single-owner mall:** one `PropertyOwnership`; shops = units; tenants = retail leases; mall operator = managing org (C). Metrics: GLA, % leased, anchor vs small shop, sales per m² (feeds turnover rent), footfall.
- **Strata mall:** per-shop `PropertyOwnership` (D) **plus** common-area CAM budget levied across owners/tenants; the mall "operator" is a management agreement from the corporation/association.
- Anchor handling: anchor spaces are just large units with different lease terms; GLA of anchor counted in occupancy math (Kimco splits anchor ≥10k sqft vs non-anchor).
- Casual/short-term licensing (kiosks, ATMs, promo bays): model as short **License** records or leases with `tenureType=LICENSE` — decision point for lease design; flag to `property.md` follow-up.

### 2.4 Authorization consequences (see research-property-1)

- Access = **permission ∧ relationship** where relationship ∈ {ownership, management agreement, staff assignment}.
- Owner parties without org membership see nothing until owner-portal phase (Phase 4+); until then owners are managed *by* org members.
- Never infer tenancy/ownership from arbitrary data; `organizationId` always explicit.

---

## 3. Land as a first-class property type

A property can be **just land** (`property.md` allows it; sale workflow needs it — research-property-4).

**What land needs that buildings don't:**

| Field/concept | Notes |
| --- | --- |
| Plot size in acres/hectares with value+unit | BuyRentKenya shows ac/m² both |
| Title: number (L.R./Parcel), type (freehold/leasehold), registry ref, **title status** (`READY/PROCESSING/NONE`) | sale-critical |
| Survey: plan no., beacons surveyed, mutation status | "Surveyed, Beacons in Place" is a listing trust badge |
| Zoning / land use + control area | county PPA2/change-of-user; agricultural land → Land Control Board consent on sale |
| Rates & land rent clearance | clearance certificates status + expiry |
| Encumbrances/charges/caveats | from official search |
| Access & utilities: road type, water, power, sewer flags | standard listing filters |
| Boundary polygon (optional GeoJSON) + **pin required** | research-property-2 §3 |
| Subdivision: parent parcel → daughter plots (units!) | a subdivided property's `PLOT` units each get own title later |

**Land occupancy:** units/leases usually absent — the "unit" may be the plot itself. Occupancy dashboards must not render `0/0` nonsense: for `category=LAND`, property dashboard shows sale-pipeline stats instead (research-property-4) and hides rent KPIs.

---

## 4. Tenant management (the tenant-centered system)

### 4.1 Core rule: Tenant ≠ User ≠ Lease

- `Tenant` = a **party record** (person or company), org-scoped, independent of auth users (BUILD.md Phase 2 explicitly: "Tenant (separate from User)").
- One tenant → **multiple leases** (acceptance criterion), possibly across properties.
- Lease ↔ tenant link table (`LeaseTenant`) carries the **relationship**: `PRIMARY`, `JOINT`, `GUARANTOR` (co-signer), `OCCUPANT`.
- Joint tenants supported **without duplicating the lease** (`property.md` §3).

### 4.2 `Tenant` record — complete field list

| Group | Fields |
| --- | --- |
| Identity | `id`, `organizationId`, `displayName` (legal name), `partyType` (`PERSON`/`COMPANY`), `email`, `phone`, `altPhone`, `idType` (`NATIONAL_ID`/`PASSPORT`/`ALIEN_ID`/`REG_NO`), `idNumber`, `nationality`, `kraPin?` (company/high-value), `dateOfBirth?`, `photo?` |
| Employment/finance | `employer?`, `jobTitle?`, `incomeVerified?` (flag, values stay in screened docs), `bankReference?` |
| Contacts | addresses (current/postal), `emergencyContact {name, relationship, phone}`, `preferredChannel` (`SMS`/`WHATSAPP`/`EMAIL` — WhatsApp is the norm in Kenya platforms) |
| Guarantor | link to another Tenant party or embedded guarantor fields (per guarantor-form research: name, address, employer, income, relationship, signs guarantee covering rent + all lease obligations, survives renewals) |
| Portal | `portalUserId?` → optional `User` (portal invite flow: "Send Login Email" pattern from Origin/Buildium Resident Center) — Phase 4 |
| Status | `ACTIVE`, `PROSPECT`, `APPLICANT`, `PAST`, `BLACKLISTED?` (with audit + permission care) |
| Relations | `leases[]`, `applications[]`, `guarantorFor[]`, `documents[]` (ID copies, refs, pay slips — private storage), `notes[]` (internal only, never shown to tenant) |
| Audit | timestamps, createdBy |

**PII rule:** `tenant.read` on every access; ID/financial docs never appear in list views; notes are internal-only (Origin precedent).

### 4.3 Lifecycle (researched pipeline → our statuses)

```
Prospect/lead ──enquiry──▶ Application ──screening──▶ Approved ──sign lease──▶ ACTIVE TENANT
 (lead.* owned              (application.*)           │                        │
  by leasing/agent)          Denied/Withdrawn ─────────┘              renewal / transfer
                                                                          │
                                                                     notice → move-out
                                                                          │
                                                                     CLOSED → PAST TENANT
```

| Stage | Facts researched (Buildium screening, VitaUnits, Origin, guarantor forms) |
| --- | --- |
| Application | Applicant + co-applicants + guarantor(s); ID upload; income proof (3 months pay slips/bank statements); application fee; references |
| Screening | Credit/criminal/eviction/ID/income verification (3rd-party integrations later; **v1 = manual checklist with document uploads**), per-property pre-screen criteria (income ≥ 2–2.5× rent is a common rule) |
| Decision | `APPROVED` / `CONDITIONAL` / `DENIED` (+ adverse-action record if integrated later) |
| Active | Primary resident flag; joint tenants; insurance liability; deposit recorded in ledger (`property.md` deposit terms) |
| Renewal | Renewal status & upcoming dates; renewal offers; rent-increase rules (jurisdiction-specific, later) |
| Move-out | Notice recorded on lease (`Ending/notice` state), inspection, deposit reconciliation via ledger, tenant → `PAST` when no active leases remain |
| Past | Kept for record-keeping (Origin: "Past residents remain in the system") — never hard-deleted while financial history exists |

### 4.4 Tenant directory & views (pages — cross-ref research-property-1 §4.2)

- **Directory:** search by name/phone/unit/property; columns: name, contact channel, active lease(s), balance (derived), status; PII-gated.
- **Tenant profile:** identity card, documents, guarantors, leases (current + past), ledger (charges/payments/adjustments), maintenance requests, communications log, notes.
- **Multi-lease tenant:** profile lists all leases with property/unit breadcrumbs; ledger aggregated but drill-down per lease.
- **Arrears view:** derived outstanding by tenant, overdue vs current split (`property.md` §7).

### 4.5 Tenant communications & portal (scope flag)

- v1: internal records + outbound links (receipts, notices) — no portal.
- Phase 4 direction (AppFolio/Buildium Resident Center precedent): tenant portal for rent payment, ledger view, maintenance requests, document access, announcements/renewal offers — all reading the same org-scoped records through a **tenant-scoped authorization context** (future work; design note only, not Phase 2).

---

## 5. Type × ownership quick-reference (what "clearly indicated" looks like in UI)

Every property card/detail must badge: **type · category · ownership shape · status · pin**:

```
┌───────────────────────────────────────────────┐
│ Greenview Mall            [MALL] [COMMERCIAL] │
│ 📍 Knutsen Rd · Open in Maps  ✅ Active       │
│ Owners: 24 (strata)  ·  Managed by: Siso PM   │
│ GLA 12,400 m² · Occupancy 91% · 3 vacancies   │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Plot LR 23269/35 — Kitengela                 │
│ 📍 Pin  ·  [LAND / RESIDENTIAL_PLOT]          │
│ Owner: J. Mwangi (direct) · Status: ACTIVE   │
│ 0.5 ac · Title READY · For sale pipeline →    │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Riverside Court A (12 units)                  │
│ [APARTMENT_BLOCK] [RESIDENTIAL]               │
│ Owners: 9 unit owners (sectional) · Siso PM   │
│ Occupancy 10/12 · Service charge: by share    │
└───────────────────────────────────────────────┘
```

---

## 6. Open decisions for implementation

1. **`OwnerParty` table name** — `owner` conflicts conceptually with role slug `owner`; prefer `PropertyOwnerParty` or `OwnerContact`. Decide with schema.
2. **License (mall kiosk) vs short lease** — recommend lease with `tenureType` flag in v1 to avoid a parallel lifecycle.
3. **Turnover/percentage rent** — confirm charge-rule design supports it (needs tenant sales reporting — can be v2; keep the charge source pluggable).
4. **Service charge budgets** — v1 can compute per-unit share from a flat budget amount; full CAM reconciliation deferred with utility billing (F-tier keys).
5. **Blacklisting** — if supported, requires `tenant.read`+strict audit; recommendation: defer, keep `notes`.
