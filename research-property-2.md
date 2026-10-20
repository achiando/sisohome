# research-property-2.md — Property record: full data model, map pin, platform field parity (source of truth)

Series index: research-property-1 (permissions/roles/pages) · **2 (this: property data model, geolocation, platform parity)** · 3 (property types, multi-owner, tenants) · 4 (sale workflow).
Builds on `property.md` §2 (Property / Building / Unit decisions) — this doc turns that into researched, field-level detail.

---

## 1. Design rule recap (from `property.md`)

- The **Property record = the physical asset only.** No balances, no tenant-specific rent, no current occupancy counters that can drift — those live on lease/ledger records and are derived.
- **Unit defaults are templates**, not obligations; changing them never rewrites a live lease or posted charge.
- Building is optional; units attach to property directly or via building.
- Everything is `organizationId`-scoped; ownership & management live in separate records (research-property-1/3).

---

## 2. `Property` — complete field list

### 2.1 Identity

| Field | Type | Notes | Required |
| --- | --- | --- | --- |
| `id` | uuid PK | | system |
| `organizationId` | uuid FK | tenant boundary (always in `where`) | ✅ |
| `propertyRef` | string unique-per-org | human code, e.g. `SHP-0001` (auto on create) | ✅ |
| `name` | string | "Greenview Apartments" | ✅ |
| `description` | text | marketing + internal | |
| `category` | enum | see research-property-3 taxonomy (`RESIDENTIAL`, `LAND`, `COMMERCIAL`, `MIXED_USE`, `INDUSTRIAL`, `SPECIAL`) | ✅ |
| `propertyType` | string/enum | granular subtype (`APARTMENT_BLOCK`, `SHOP`, `MALL`, `PLOT` …) — full list in research-property-3 | ✅ |
| `status` | enum | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` (`property.md` §2) | ✅ default DRAFT |
| `tags` | string[] | freeform grouping | |
| `currency` | string(3) | default `KES` — property-level default | ✅ default KES |
| `defaults` | Json | configurable property-level defaults (`property.md`): rent frequency, deposit months, late-fee rule, notice days, service-charge rate | |
| `createdAt` / `updatedAt` / `createdBy` / `updatedBy` | | audit | system |
| `archivedAt` / `archivedBy` | nullable | soft archive (never hard-delete with history) | |

### 2.2 Location & map pin (authoritative pin spec — §3 below)

| Field | Type | Notes |
| --- | --- | --- |
| `addressLine1` | string | building/plot name + street |
| `addressLine2` | string? | estate/complex |
| `locality` | string | suburb/ward/town (searchable) |
| `region` | string | county/state/province |
| `postalCode` | string? | |
| `country` | string | ISO-3166 |
| `formattedAddress` | string | one-line canonical display, geocoder output |
| `latitude` | Decimal(9,6) | **the pin** |
| `longitude` | Decimal(9,6) | **the pin** |
| `googlePlaceId` | string? | ties the pin to Google's place record (optional but recommended) |
| `plusCode` | string? | optional human-quotable code (Kenya listings often use one) |
| `directionsNote` | text? | "500 m past the roundabout, gate on the left" |
| `landmark` | string? | quick reference for research/viewings |
| `boundary` | Json? (GeoJSON) | optional parcel polygon (later; land) |

### 2.3 Legal / title (works for buildings **and** land — see research-property-3/4)

| Field | Type | Notes |
| --- | --- | --- |
| `titleType` | enum? | `FREEHOLD`, `LEASEHOLD`, `SECTIONAL_TITLE`, `CUSTOMARY`, `UNKNOWN` |
| `titleNumber` | string? | Kenya: L.R. No. / Parcel No. / CR No. (e.g. `LR 23269/35`) |
| `registryReference` | string? | registry/Ardhisasa reference |
| `surveyPlanNumber` | string? | |
| `landControlArea` | string? | Land Control Board area (sale of agricultural land) |
| `zoning` | string? | county zoning / land use class |
| `rateClearanceStatus` | enum? | `UNKNOWN`, `CLEARED`, `OUTSTANDING` (+ `rateClearanceExpiresAt`) |
| `encumbrances` | text? | charges/caveats noted from official search |
| `titleDocumentId` | FK? | link to stored title-deed scan (`PropertyDocument`) |

Not required for a lease-only MVP, but **required before a sale listing** (research-property-4 checklist).

### 2.4 Physical attributes

| Field | Type | Notes |
| --- | --- | --- |
| `yearBuilt` | int? | |
| `yearRenovated` | int? | |
| `floors` | int? | |
| `totalUnits` | int? **derived** | maintained by trigger/aggregate, never user-entered as truth |
| `plotSizeValue` + `plotSizeUnit` | decimal + enum | unit enum: `SQM`, `SQFT`, `ACRE`, `HECTARE`, `HA` |
| `buildingAreaValue` + `buildingAreaUnit` | decimal + enum | built-up area |
| `glaValue` | decimal? | **Gross Leasable Area** — commercial/mall metric (Kimco/Brixmor report GLA, % leased — see research-property-3) |
| `floorsCount` | int? | alias of `floors` if kept |
| `constructionType` | string? | e.g. Masonry, Steel |
| `condition` | enum? | `NEW`, `GOOD`, `FAIR`, `NEEDS_WORK` |
| `parkingSpaces` | int? | total |
| `amenities` | string[] | controlled vocabulary: `PARKING`, `CCTV`, `SECURITY`, `LIFT`, `GENERATOR`, `BOREHOLE`, `SOLAR`, `GARDEN`, `GYM`, `POOL`, `PLAYGROUND`, `WHEELCHAIR_ACCESS`, `GATED`, `BACKUP_POWER`, `FIRE_SYSTEM`, `DUMPSITE`, `WI_FI` |
| `utilities` | string[] | `WATER`, `ELECTRICITY`, `SEWER`, `GAS`, `FIBER`, `T4` availability flags (availability ≠ billing) |
| `nearby` | Json? | context: schools/hospitals/transit (nice-to-have; Zillow parity table §4) |

### 2.5 Media

| Field | Type | Notes |
| --- | --- | --- |
| `images` | relation | `{ id, url, caption, sortOrder, takenAt, isCover }` — galleries like BuyRentKenya listings |
| `floorPlans` | relation/Json | plan images with labels |
| `virtualTourUrl` | string? | 3D tour link (Zillow: listings with 3D tour get ~2× page views) |
| `videoUrl` | string? | walkthrough video (BuyRentKenya filter "virtual tours and videos") |
| `documents` | relation | `PropertyDocument` (title deed, PPA2, photos, reports) — separate model per `property.md` §6 |

### 2.6 Explicitly NOT on Property

- current rent/utility balances, tenant names, occupancy booleans (derived), default rent for units (→ `Unit`), agent (→ `PropertyAgentAssignment`), management company (→ `PropertyManagementAgreement`), owners (→ `PropertyOwnership`), listing price (→ `Listing`).

---

## 3. Map pin & address — how the "open in Google Maps" link works

### 3.1 What Google officially supports (no API key required)

Source: Google Maps URLs docs (`developers.google.com/maps/documentation/urls/get-started`, last updated 2026-10). Key facts:

- Universal URLs work on Android (app or browser), iOS (app or browser), desktop. **No API key needed.**
- `api=1` is **required** in every URL or all other params are ignored.
- URLs are limited to **2,048 characters**; encode params (`,` → `%2C`, spaces → `%20`/`+`).
- Place IDs are the most precise link target; recommended alongside coordinates.

| Intent | URL template |
| --- | --- |
| **Open pin (search)** — the default "research this property" link | `https://www.google.com/maps/search/?api=1&query={lat},{lng}` |
| Open pin with place details | `https://www.google.com/maps/search/?api=1&query={lat},{lng}&query_place_id={placeId}` |
| Open by address text | `https://www.google.com/maps/search/?api=1&query={urlencoded address}` |
| **Directions to property** (site visit) | `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` (+ `&travelmode=driving`) |
| Satellite/map view centered on property | `https://www.google.com/maps/@?api=1&map_action=map&center={lat},{lng}&zoom=17&basemap=satellite` |
| Street View at the pin | `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lng}` |

Worked example (Nairobi): `https://www.google.com/maps/search/?api=1&query=-1.286389%2C36.817223`

**Build a single helper** (e.g. `apps/web/lib/maps.ts`):

```ts
export const mapsPinUrl = (lat: number, lng: number, placeId?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}` +
  (placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '');

export const mapsDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`;

export const mapsSatelliteUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/@?api=1&map_action=map&center=${lat}%2C${lng}&zoom=17&basemap=satellite`;
```

Render as a normal `<a target="_blank" rel="noopener">` — works everywhere, zero cost, zero key.

### 3.2 Storing the pin (capture UX)

| Option | Cost | Use |
| --- | --- | --- |
| **A. Free picker: OpenStreetMap/Leaflet embed** → user drops pin → we store `lat/lng` + reverse-geocoded address | $0 | Recommended default for capture. Google links are built from the *stored coordinates*, so a Google key is unnecessary |
| **B. Google Places Autocomplete + Maps JavaScript API** | billed per call | Best address UX (canonical `placeId`); only if budget approved |
| **C. Manual entry** — paste "lat, lng" or a Google Maps URL and parse the `@lat,lng` | $0 | Always support as fallback: `parseGoogleMapsUrl()` extracts coordinates from any pasted Maps share link |
| **D. What's-here / long-press in Google Maps app** | $0 | User copies coords → paste into form (common practice in Kenya listings) |

Rules:
1. `latitude`/`longitude` are **required to publish a listing** and to show the map card; the address text alone is not enough.
2. Store coordinates, never a Google Maps *link* as data (links are derived).
3. Reverse geocode once at capture to prefill `formattedAddress`; user can edit.
4. Validate ranges (lat −90..90, lng −180..180) and reject `(0,0)`.
5. Property detail page always renders: address block + **"Open in Google Maps"** + **"Directions"** + static map preview (OSM tile is free; Google Static Maps is billed).

### 3.3 Why the pin matters for "property research"

The pin lets a user (or an external researcher) instantly check: neighborhood context, satellite view of the plot/boundary, distance to amenities, street view condition, and — for land — whether the described parcel matches surroundings. It is also the join key for viewings (directions link) and for the sale pipeline (research-property-4).

---

## 4. `Building` and `Unit` — complete field lists

### 4.1 `Building` (optional)

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `organizationId`, `propertyId` | | scoped |
| `code` / `name` | string | "Block A", "Tower 2" — unique within property |
| `floors` | int? | |
| `description` | text? | |
| `yearBuilt` | int? | optional override |
| `isActive` | bool | |
| timestamps | | |

### 4.2 `Unit` (the rentable/sellable space — also a mall shop, office, kiosk, parking bay)

| Field | Type | Notes | Required |
| --- | --- | --- | --- |
| `id`, `organizationId`, `propertyId` | | | ✅ |
| `buildingId` | uuid? | null = unit directly on property | |
| `unitRef` | string | unique within property: `A-12`, `SHOP-04`, `PLOT-7` | ✅ |
| `label` / `unitNumber` | string | display | ✅ |
| `unitType` | enum/string | `STUDIO`,`BEDSITTER`,`1BR`,`2BR`,`3BR`,`4BR+`,`MAISONETTE`,`VILLA`,`SHOP`,`OFFICE`,`WAREHOUSE`,`KIOSK`,`SHOWROOM`,`PARKING`,`PLOT`,`FLOOR`,`MEZZANINE` | ✅ |
| `floor` | int? | | |
| `areaValue` + `areaUnit` | decimal + enum | sqm/sqft — **this is the leasable GLA contribution for malls** | |
| `bedrooms` / `bathrooms` | int? | residential defaults | |
| `status` | enum | `VACANT`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`, `BLOCKED` — **displayed status derived from lease dates where possible** (`property.md` §3: occupancy must be consistent with lease dates, not only manual) | ✅ |
| `defaultRent` | decimal? | template only — never rewrites leases | |
| `currency` | string? | falls back to property currency | |
| `billingFrequency` | enum? | `MONTHLY`,`QUARTERLY`,`WEEKLY`,`CUSTOM` | |
| `depositDefault` | decimal? | months or amount (per property default) | |
| `recurringChargesDefault` | Json? | template lines (service charge, garbage, water) | |
| `parkingBays` | int? | | |
| `amenities` | string[] | unit-specific (balcony, ensuite, own meter) | |
| `notes` | text? | | |
| `isActive` | bool | | |
| `occupancy` (derived) | view/computed | from `LeaseUnit` where lease active on `today` | |
| timestamps | | | |

### 4.3 `UnitType` (optional catalog)

`property.md` §8 lists `UnitType` as phase-1 structure: `{ id, orgId, name, bedrooms, bathrooms, area, baseRent, description }` — a reusable template when onboarding similar units in bulk (Elite Tenants-style "add units 101–124 in one range").

---

## 5. Platform field parity

### 5.1 What Zillow carries (300+ fields; the canonical US reference)

Research sources: Zillow property pages (facts & features), Zillapi field reference (9 sub-resources), Zillow search filters. Grouped with adoption verdicts for SisoHome:

| Zillow group | Fields | SisoHome adoption |
| --- | --- | --- |
| **Identity** | `zpid`, address (street/city/state/zip), lat/lng, county | ✅ `propertyRef`, address fields, lat/lng (`region` ≈ county) |
| **Valuation** | `zestimate`, `rentZestimate`, price history, last sold, tax assessed value, price/sqft | ⚠️ Not an AVM in v1 — store `Listing.askingPrice`, sale history as events (research-property-4), **valuations** as optional `PropertyValuation` records later |
| **Core facts** | bedrooms, bathrooms, livingArea, lotSize, yearBuilt, homeType, parking, heating, cooling | ✅ all (heating/cooling → amenities/utilities vocabulary) |
| **Media** | 35+ photos, open houses, virtual tours | ✅ images + virtualTourUrl + open-house events (viewings) |
| **Context** | schools (ratings/distance), nearby comps, walk/transit/bike scores | ⚠️ later/nice-to-have; keep `nearby` Json slot; comps belong to sale pipeline research |
| **History** | priceHistory events, taxHistory (annual) | ⚠️ tax/rates history optional (Kenya: rates clearances instead of annual tax history) |
| **People** | listing agent/broker contact | ✅ `PropertyAgentAssignment` + Listing contact |
| **Parcel/legal** | parcel number, zoning, subdivision, HOA fee | ✅ titleNumber, zoning, service charge (HOA ≈ service charge/levy) |
| **MLS blob** | `resoFacts` (appliances, flooring, view, foundation, roof, construction, special conditions) | ⚠️ keep `attributes Json` escape hatch on Unit/Property for type-specific extras rather than 300 columns |
| **Building mode** | multi-unit buildings extracted **unit-by-unit** | ✅ our Building/Unit model is exactly this |
| **Search filters** | price, beds, baths, sqft, year built, home type (`Houses, Townhomes, Multi-family, Condos/Co-ops, Lots-Land, Apartments, Manufactured`), status (`For_Sale / For_Rent / Sold`) | ✅ filter set for `/portfolio` and public listings: price, beds, baths, size, type, status |

### 5.2 What Kenya platforms carry (BuyRentKenya / Private Property / Jumuika)

| Group | Fields | SisoHome adoption |
| --- | --- | --- |
| **Purpose** | For Sale / For Rent / Project (new development) | ✅ `Listing.purpose` ∈ {`SALE`,`RENT`} (+ `DEVELOPMENT` flag) |
| **Category tree** | Apartments · Houses · Villas · Townhouses · Bedsitters · Land (Residential/Commercial) · Commercial Property (Offices, Shops, Warehouses) | ✅ the `propertyType` enum (full tree in research-property-3 §1) |
| **Size** | plot/house size in **m², acres, hectares, sqft**; bedroom counts 1/2/3/4+; bathrooms 1/2/3 | ✅ value+unit pairs; never a single "size" number |
| **Price** | KSh total, or KSh/month rental; price-on-request | ✅ `Listing.price` + `priceFrequency` (`TOTAL`,`MONTHLY`,`PER_SQM`,`ON_REQUEST`) |
| **Amenities filters** | Balcony, CCTV, Electric fence, Garden, Lift/Elevator, Parking, Wheelchair access, Gated community, Kids play area, Pet friendly | ✅ amenities vocabulary (§2.4) — make these exact strings searchable |
| **Media** | photos gallery, virtual tour & video badges | ✅ |
| **Contact** | WhatsApp, Call, Email buttons per listing; agent **or** owner-direct | ✅ listing contact channels + `contactOwnerDirect` flag |
| **Trust** | verified listings badge, "Title Deed Ready", "Surveyed, Beacons in Place", "Ready documents" | ✅ verification flags: `titleStatus` (`READY`,`PROCESSING`,`NONE`), `verificationStatus` (platform check) |
| **Locality** | Nairobi/Mombasa + suburb (Westlands, Kilimani…) + county | ✅ locality + region |
| **Highlights text** | free-text bullets | ✅ `highlights string[]` |
| **Saved searches / alerts / favourites** | account features | ⚠️ later (portal phase) |

### 5.3 One-page "listing detail" spec (what our public/listing view must show)

Derived from Zillow + BuyRentKenya detail pages:

1. Price (+ frequency) · status badge · date listed
2. Address + **map pin card → "Open in Google Maps"** (§3) + locality
3. Core facts strip: beds · baths · size (with unit) · yearBuilt · parking · property type
4. Photo gallery (cover first) + video/virtual-tour buttons
5. Description + highlights
6. Features/amenities chips (filter vocabulary reused)
7. Utilities & services availability
8. Legal strip (title status, zoning) — esp. for land
9. For sale: agent contact, offer CTA; for rent: application CTA
10. Agent/owner card, viewing scheduling (if `viewing.*`)
11. Documents (prospectus/floor plan) where permitted
12. Research links: satellite view, directions, nearby context

---

## 6. Derived vs stored (drift protection)

| Metric | Rule |
| --- | --- |
| Occupancy (`18 / 24`) | Derived: units with an active lease today ÷ active units |
| Outstanding / billed / collected | Derived from ledger (`property.md` §7) — **never** stored on Property |
| `totalUnits` | Derived count (ok to cache with recompute on unit change) |
| Unit `status` column | **Opinionated cache** — recompute on lease create/close; UI shows derived value where a lease exists |
| Property-level dashboards | All computed server-side from underlying records; distinguish overdue vs current within outstanding |

---

## 7. Storage & media notes

- Photos: private object storage with signed URLs (BUILD.md Phase 2 mentions private versioned storage for lease docs — reuse for property media; make marketing photos public-readable only when listing is published).
- Every image row: `orgId`, `entityType` (`PROPERTY|UNIT|LISTING|LEASE|TENANT`), `entityId`, `sortOrder`, `isCover`.
- `attributes Json` on Property + Unit for type-specific extras (avoids schema churn per type; promoted to columns only when frequently filtered).
