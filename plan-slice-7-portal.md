# Slice 7 — Tenant portal (invite accept, portal guard, tenant-scoped views)

Schema-ready since batch 2 (`Tenant.portalUserId/portalStatus`, `TenantPortalInvite`, `Session.organizationId = null`). Org-side invite creation shipped in slice 2. This slice completes the tenant user-type story: **a person can be staff of one org and a tenant of another — the portal is a separate, org-less shell**.

## 1. Architecture decisions (locked)

1. **Same auth stack, different shell.** Portal sign-in = existing `User`/`Password`/`Session` with `organizationId = null`. A user with NO org membership lands in `/portal`; a dual-role user picks: org app vs portal (portal accessible at `/portal` regardless; org routes require active membership — already structurally isolated).
2. **Portal guard**: `apps/web/lib/portal-guard.ts` (server helper for portal API routes):
   ```
   resolvePortalTenant(request):
     session (cookie) → must exist, organizationId must be NULL? NO — dual-role users keep org sessions…
   ```
   **Complication (decide now)**: a dual-role user's session may carry an org. Two options:
   - **(A) Portal routes read the tenant via `userId` + `?` no org**: any session whose `userId` has `portalStatus=ACTIVE` tenants → portal pages list *their* tenants (user may have tenants in several orgs). Org context never used. **Chosen: (A)** — portal resolution = `Tenant.findMany({ portalUserId: session.userId, portalStatus: 'ACTIVE' })`; if none → 403 "No portal access". Sessions with orgs MAY use the portal (they're the same person). Org APIs are unaffected (they require org session; portal APIs **reject** org-scoped *authorization* (no permission keys exist for tenants — portal has no roles/permissions: it's relationship-based: **your tenant row**).
   - Portal API guard = thin `apiRoute({ requireOrg: false, permissions: undefined })` wrapper variant… careful: `apiRoute` defaults `requireOrg: true`. Need `apiRoutePortal(handler)`: resolve session → userId → resolve owning tenant(s) → pass `tenantActor = { userId, tenantId, organizationId (the org that manages this tenant — for scoping reads) }`. Reads then filter `where: { tenantId: t.id }` or `lease: { parties: { some: { tenantId } } }`.
3. **What the portal reads** is ALWAYS projection/relationship-scoped: their own leases, their own charges/payments, their own tickets, documents explicitly shared to their tenant/lease entities. Never org lists, never other tenants (PII).
4. Portal **writes**: maintenance ticket create (→ `MaintenanceTicket.reportedByTenantId`), viewing RSVP later (defer), payment *initiation* stub (real M-Pesa integration out of wave — show "pay via M-Pesa till" instructions from lease/property config + record manual `Payment` only by org staff). Portal cannot create leases/charges.
5. **Invite acceptance** (the entry): emailed link `/portal/accept?token=` → validates `TenantPortalInvite` (hash, expiry, unused) → create-or-link `User` (email match), set `emailVerifiedAt`, link `portalUserId`, `portalStatus=ACTIVE`, mark invite used, **create session** (org-less) → land `/portal`. Password set during acceptance (new user) or claimed by existing login (existing user with same email → require login first, then accept — flow: if user exists and no session → redirect login with `next` → accept with session).

## 2. API routes (`app/api/portal/*` — all org-less)

| Method & path | Auth | Rules |
| --- | --- | --- |
| `POST /api/portal/accept` | public (token) | body `{token, password?}`; validations above; rate-limited like auth endpoints (reuse `lib/rate-limit`); issues session cookie; returns `{ok}` |
| `GET /api/portal/session` | session | returns `{tenants: [{id, displayName, orgName, portalStatus}]}` for multi-tenant users (tenant picker) + profile |
| `POST /api/portal/switch-tenant` | session | if user has >1 active tenant: binds chosen `tenantId` into a portal context cookie (signed value) — subsequent portal reads verify it belongs to the user |
| `GET /api/portal/lease` | session+context | active + historical leases for tenant: status, dates, units, org (property-manager contact), renewal info — org read via lease parent scope **restricted to tenant's rows only** |
| `GET /api/portal/statement` | session+context | charges + payments + balance **for this tenant's leases** (derived balance) |
| `GET /api/portal/documents` | session+context | `PropertyDocument where entityType∈[TENANT, LEASE] and entityId ∈ their tenant/lease ids` (+ property docs flagged public? **no — only tenant/lease entities + any document explicitly `entityId`-linked to their lease**) |
| `GET /api/portal/tickets` + `POST /api/portal/tickets` | session+context | list own (`reportedByTenantId = tenantId`); create: title/desc/category/priority + property/unit must match their lease units → creates org-side `MaintenanceTicket` (org staff sees it normally in slice 3 UI) |
| `PATCH /api/portal/tickets/[id]` | session+context | only tickets they reported; **only append notes** (status stays org-controlled) |
| `GET /api/portal/payment-methods` | session+context | static payment instructions (M-Pesa paybill/till from org/property config fields if present — else placeholder text from lease `terms`/org profile) — no real payments |

Security checklist (portal-specific):
- [ ] every portal route: resolve context → filter by `tenantId` — **cross-tenant IDs 404**, regardless of guessing
- [ ] no permission-key checks (relationship-based) BUT `requireOrg`-style session resolution still enforced; `mustChangePassword` respected
- [ ] portal responses never include org staff data (assignee names → masked)
- [ ] org sessions calling portal endpoints work (dual-role) but never leak org context into portal queries

## 3. UI — separate shell `app/(portal)/`

Routing group with its own minimal layout (no dashboard sidebar): header (SisoHome Portal + tenant picker + sign out), single column mobile-first.

| Route | Purpose | Gate |
| --- | --- | --- |
| `/portal/login` | reuse existing login screen variant? **decision: reuse `(auth)/login` with `next=/portal`** — portal has no separate login page | — |
| `/portal/accept?token=` | accept screen: name from invite, set password (new user) / confirm identity, submit → `/portal` | token |
| `/portal` | home: active lease card, balance due + due date, latest notice, quick actions (Report issue, View statement) | context |
| `/portal/lease` | lease detail: dates, units, rent, parties (their view), documents, timeline | context |
| `/portal/statement` | charges/payments table + running balance | context |
| `/portal/tickets` + `/new` | own tickets list + `<PortalTicketForm>` (create) + detail w/ org replies (notes history) | context |
| `/portal/documents` | their documents (download links) | context |
| `/portal/profile` | contact info edit? **read-only in v1** (org staff own tenant PII) + sign out | — |

`proxy.ts` currently treats any session as app-bound — portal routes must be **allowed without org** (check proxy logic: cookie presence only — verify `/portal/*` not redirected to onboarding for org-less users; adjust proxy allowlist).

## 4. Org-side UI hookup (small, ships here if not done in slice 2)

- Tenant profile: invite dialog → after send shows status; resend while INVITED (rotate token); **revoke invite** (`tenant.manage` → expire token, portalStatus back NOT_INVITED)
- Tenant list column: portal status badges

## 5. Sequencing

1. `portal-guard`/context resolution + accept endpoint (+ email link generation in slice-2 invite flow — wire the mail template now: reuse outbox pattern, template in `apps/web/lib/email/`)
2. Portal shell layout + proxy allowlist
3. lease/statement/documents reads
4. tickets create/list
5. org-side badges/invite polish
6. smoke

## 6. Acceptance & smoke `smoke-portal-e2e.sh`

- [ ] landlord: tenant → invite → outbox mail contains `/portal/accept?token=` (follow existing email-smoke conventions)
- [ ] fresh visitor: accept with token + password → session created, `GET /api/portal/session` → 1 tenant; `GET /api/portal/lease` shows the active lease; `GET /api/portal/statement` balance math matches org-side charge
- [ ] **cross-tenant isolation**: create second tenant+lease (same org); portal session of tenant A requesting tenant B's ticket/lease id → 404; `POST switch-tenant` with B's id → 403
- [ ] portal `POST /api/portal/tickets` → org session sees ticket in `/api/maintenance/tickets` with `reportedByTenantId` set; portal cannot PATCH status (403/not found)
- [ ] org-less user hitting `/` (app) → still redirected to onboarding/login flow; hitting `/portal` → 200; portal endpoints with **no** session → 401
- [ ] dual-role user (org member + tenant): org APIs still work in same browser session; portal shows their tenant
- [ ] rate limit on `/api/portal/accept` (token guessing) — hits 429 like auth endpoints
