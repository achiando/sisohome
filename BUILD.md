# SisoHome — Build Document

Single source of truth for **what we are building, in what order, and when it is done.**

| Source | Role |
| --- | --- |
| `sisohome.md` | Layer 1 architecture blueprint (operating model, domain, roles, finance, phasing) |
| `sisohome-1.md` | Layer 2 implementation plan (ownership model, Prisma shapes, RBAC hardening, migration risks) |
| `packages/database/prisma/schema.prisma` | **Data source of truth** — current database reality |
| `siso-design/design.json` | **UI source of truth** — design philosophy extracted from `siso-design/*.webp` mockups |
| `BUILD.md` (this file) | Build sequence, scope, and acceptance gates |

Rule: schema wins for data, `design.json` wins for UI, this document wins for sequencing. When one changes, update the others.

---

## 1. Where we are today

### Works

- **Auth**: `/api/auth/login|signup|session|logout` + `AuthGuard` / `usePermissions` client state.
- **RBAC engine** (`@workspace/database`): `AuthorizationService` (`can`/`require`/`getUserPermissions`), `PermissionGuard`, `protectRoute`, `PolicyEngine`, session cache, audit logging. Default-deny.
- **Schema**: `User`, `Organization`, `OrganizationMember`, `Role`, `Permission`, `RolePermission`, `OrganizationMemberRole`, `ResourceRelationship`, `AuditLog`, `Session`.
- **Seeds**: 45 permission keys + 6 system roles (`platform_admin`, `organization_owner`, `organization_admin`, `organization_manager`, `organization_member`, `organization_viewer`).
- **UI kit** (`@workspace/ui`): 99 components incl. `ResponsiveDataListing`, `PageShell`, `UniversalForm`, `Sidebar`/`SectionNav`, `Sheet`, `Toast`.
- **Toolchain**: Prisma 7 + `@prisma/adapter-pg` singleton fixed; `pnpm build`, `pnpm typecheck`, bcrypt native binding all green.

### Missing / broken (must close)

| # | Gap | Where |
| --- | --- | --- |
| 1 | **Signup grants an empty org-scoped `owner` role — zero permissions.** New users effectively have no role. | `packages/database/src/authentication/password-provider.ts:204-240` |
| 2 | **No role/user/membership management at all** — no API routes, no admin UI. Permission keys like `role.assign` exist but are never enforced because nothing uses them. | — |
| 3 | **No app shell in `apps/web`** — no `dashboard/layout.tsx`, no sidebar/header/nav. | `apps/web` |
| 4 | **No server-side route protection** — no `proxy.ts`, no `protectRoute` usage; client `AuthGuard` only. | `apps/web` |
| 5 | `TenantService` never instantiated → `protectRoute`/`PermissionGuard` unusable as-is. | `apps/web/lib/auth.ts` |
| 6 | Cross-org role assignment possible at model level (`OrganizationMemberRole` can bind a member to another org's role). | schema + assignment flow |
| 7 | Global role slug uniqueness not enforced in Postgres (`Role.organizationId` nullable, `@@unique([organizationId, slug])` ignores NULLs). | `schema.prisma:232-252` |
| 8 | `Session.organizationId` has no relation and no membership validation. | `schema.prisma:67-84` |
| 9 | Endpoints the client calls don't exist: `switch-organization`, `profile`, `change-password`, `new-password`. | `apps/web/app/api/auth/*` |
| 10 | No user-provisioning flow for first build (`INVITED` status exists; email invites deferred to Phase 4 — admin-creates-user is the decided model). | — |
| 11 | No property/tenancy/finance domain models anywhere (expected — they are Phase 2+). | schema |
| 12 | No server-side permission checks paired with any UI action (UI is the only gate). | `apps/web` |

---

## 2. Design track (prerequisite for UI work)

UI work was gated on a clear design philosophy. **That gate is now open.**

- `siso-design/design.json` — extracted from the 6 mockups: color, typography, radius, shadow, layout anatomy, navigation IA, component recipes (stat row, tabs, badges, table, people card, kanban), patterns, mobile rules, and the CSS token mapping.
- `apps/web/app/theme.css` — SisoHome token layer imported **after** `@workspace/ui/globals.css`; defines `--primary` (near-black), accent (emerald), semantic `--success/--warning/--info`, sidebar tokens, dark-mode track.
- `apps/web/app/layout.tsx` — `viewport` export + `<Toaster position="bottom-center" />`.
- Verified: `pnpm build` green; theme overrides win the cascade in the emitted CSS.

### Rules

1. **`design.json` first, then `theme.css`.** Never invent colors in components.
2. **Semantic utilities only**: `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `text-success`, …
3. **Mobile contract** (from `design.json.mobile`): sidebar → hamburger `Sheet`; tables → `ResponsiveDataListing` cards; filters → scrollable chips/bottom sheet; grids 1→2→3→4 cols; forms single-column with sticky footer; toasts bottom-center; ≥44px touch targets; `active:scale-[0.98]`.
4. Menu labels per mockups (Overview, Portfolio, Leasing, People, Finances, Maintenance, Calendar, Documents, Reports), evolving toward `sisohome.md` §8 as domains land. Nav items filtered by permission — never show what the server would deny.

---

## 3. Build sequence

### Phase 0 — Foundations ✅ (done)

Prisma 7 adapter, typecheck/build green, `design.json`, web theme layer, viewport/Toaster.

### Phase 1 — User & Role Management ← **FIRST BUILD**

Everything downstream is gated on *"who can do what"*. Scope: make the existing RBAC foundation **true, enforced, and operable** for every user — backend first, then API, then UI.

**Decided flows** (confirmed):

- **Signup = account only.** No organization, no roles are created at signup. After login, users land on `/onboarding`.
- **Onboarding** = choose *Create organization* (by kind: **Landlord**, **Property Management Company**, **Maintenance Company**) or **join organization(s)** they already belong to. Creating an org **auto-seeds that kind's role templates** and assigns the creator `owner` role of that kind.
- **Sessions → httpOnly cookie.** No token in JSON/localStorage.
- **Invitations = admin creates user + assigns roles immediately.** Email invites deferred to Phase 4.
- **Brand = SisoHome**, same design language as the PrimeStay mockups.

#### 1.0 Multi-org membership model (the invariant — schema already supports it)

One user can belong to **many organizations with different roles in each**. This is already modeled correctly and must be preserved everywhere:

```
User 1—* OrganizationMember (*—1 Organization)  ← membership is PER ORG (unique [orgId, userId])
OrganizationMember 1—* OrganizationMemberRole *—1 Role  ← roles hang off the MEMBERSHIP, not the User
```

**Rules that make it true:**

1. Every permission check is a function of `(userId, activeOrganizationId)` → membership → memberRoles → role → permission keys. There is no "global permission state" for a normal user.
2. **One active workspace at a time**: `Session.organizationId` + `active-organization` cookie. The switcher lists **all** memberships (with per-org role badges); switching re-evaluates everything.
3. Example: the same person is `owner` in their Landlord org **and** `technician` in a Maintenance org — full admin nav in the first, only their scoped nav in the second. Never a blended permission set.
4. Authorization cache is keyed by `(userId, organizationId)` and invalidated on org switch and role change.
5. Last-owner protection, role mutations, member lists — all scoped per org; cross-org reads return 403/404.
6. `role.organizationId ∈ { null (system), membership.organizationId }` — assigning a role from another org is impossible at the service layer.

#### 1.1 Organization kinds & role templates

Schema: `enum OrganizationKind { LANDLORD PROPERTY_MANAGEMENT MAINTENANCE_COMPANY MARKETING_AGENT }` + `Organization.kind` (nullable for legacy orgs) + `Role.isTemplate` + `User.onboardingCompletedAt`. Templates are seeded **per organization** on creation by `seedOrgKindRoles(tx, orgId, kind)` — org-scoped roles (`organizationId = orgId`, `isTemplate: true`, non-deletable) with `RolePermission` rows resolved from permission keys. Idempotent per org. Phase 2 **enriches the same roles** with domain keys (`property.*`, `lease.*`, `work_order.*`, `payment.*`) — no renames, no new tables, no re-platforming.

**Key rule — a user can hold different kinds at once.** Starting as a Landlord `owner` and later creating a Property Management Company (or a Maintenance Company) is a first-class journey: org creation is available **anytime** (shell switcher "＋ New organization", Settings → Organizations), each new org seeds its own kind's roles, the creator becomes that org's `owner`, and roles/permissions never blend across orgs.

**LANDLORD** (self-managed landlord workspace)

| Template role | Phase-1 grants (existing 45 keys) |
| --- | --- |
| `owner` | `organization.{read,update,manage,list}`, `user.*`, `membership.*`, `role.*`, `permission.{read,manage}`, `audit.{read,export}`, `resource.*` |
| `manager` | `organization.{read,list}`, `user.{read,update,list}`, `membership.{invite,view}`, `role.read`, `resource.{create,read,update,list}`, `audit.read` |
| `viewer` | `organization.read`, `user.read`, `membership.view`, `resource.{read,list}` |

**PROPERTY_MANAGEMENT** (company operating properties for owners — role names follow `sisohome.md` §4)

| Template role | Phase-1 grants | Phase 2 enriches with |
| --- | --- | --- |
| `owner` | full org control (as LANDLORD `owner`) | — |
| `admin` | `organization.{read,update,manage,list}`, `user.{create,read,update,delete,list}`, `membership.*`, `role.{create,read,update,assign,revoke}`, `permission.read`, `audit.read`, `resource.*` | — |
| `property_manager` | `organization.{read,list}`, `user.{read,update,list}`, `membership.{invite,view}`, `role.read`, `resource.{create,read,update,list}`, `audit.read` | `property.*`, `lease.*`, `tenant.*`, `maintenance.*` |
| `finance_officer` | `organization.{read,list}`, `user.read`, `resource.{read,update,list}`, `audit.{read,export}` | `charge.*`, `payment.*`, `expense.create`, `statement.read` |
| `finance_approver` | `organization.{read,list}`, `user.read`, `resource.{read,list}`, `audit.read` | `expense.approve`, `adjustment.approve` (separation of duties: submit ≠ approve) |
| `leasing_officer` | `organization.{read,list}`, `user.{create,read,update,list}`, `membership.invite`, `resource.{create,read,update,list}` | `lease.*`, `tenant.*`, `document.upload` |
| `caretaker` | `organization.read`, `resource.{read,list}` | `inspection.*`, `work_order.update`, evidence upload |
| `maintenance_coordinator` | `organization.{read,list}`, `user.read`, `resource.{read,update,list}`, `audit.read` | `work_order.*`, assignment, `schedule.*` |
| `member` | `organization.read`, `user.read`, `membership.view`, `resource.{read,list}` | — |
| `viewer` | `organization.read`, `user.read`, `membership.view`, `resource.{read,list}` | — |

**MAINTENANCE_COMPANY**

| Template role | Phase-1 grants | Phase 2 enriches with |
| --- | --- | --- |
| `owner` | full org control | — |
| `admin` | org admin matrix (as PROPERTY_MANAGEMENT `admin`) | — |
| `coordinator` | `organization.{read,list}`, `user.{read,update,list}`, `membership.{invite,view}`, `role.read`, `resource.{create,read,update,list}` | `work_order.*`, technician assignment, `schedule.*` |
| `technician` | `organization.read`, `resource.{read,list}` | `work_order.{read,update}` scoped to assigned jobs, completion evidence |
| `viewer` | `organization.read`, `resource.{read,list}` | — |

**MARKETING_AGENT** (house-marketing individual — markets homes and captures tenant leads, handing them off to a landlord or property-management org; owns no property operations, finance, or maintenance)

| Template role | Phase-1 grants | Phase 2 enriches with |
| --- | --- | --- |
| `owner` | full org control | — |
| `marketing_agent` | `organization.{read,list}`, `user.{read,update,list}`, `membership.{invite,view}`, `role.read`, `resource.{create,read,update,list}`, `audit.read` | `listing.*`, `lead.*`, `handoff.create` (tenant lead → landlord / PM org), `document.upload` |
| `viewer` | `organization.read`, `user.read`, `membership.view`, `resource.{read,list}` | — |

Notes:
- `finance_officer` vs `finance_approver` are deliberately near-identical in Phase 1 — the separation-of-duties *structure* exists from day one; Phase 2 attaches the distinct finance keys.
- `owner` template is identical across kinds (full control of that org's world) — consistency for the multi-org user.
- `marketing_agent` is **single-org staff** (staff don't blend tenants). The **handoff** — a captured tenant lead passed to a landlord or PM org — is a Phase 2 cross-org domain operation (`handoff.create`); Phase 1 captures leads as resources and seeds the role structure.
- Seeder tests assert the **exact slug set per kind** so template drift is caught in CI.
- System roles (`organizationId: null`) remain the global/platform layer (`platform_admin` etc.). **Confirmed: template roles AND system roles are both non-deletable; their permissions stay editable by an owner (templates) / platform admin (system). Only custom roles are deletable.**

#### 1.2 User journeys

- **A — First signup**: signup (user only, cookie set) → `/onboarding` → create Landlord org → templates seeded, creator = `owner` → Overview with working permissions.
- **B — Landlord grows into a PM company (key journey)**: same user later creates a **Property Management Company** org (switcher "＋ New organization") → that org seeds the PM role set (`owner`, `admin`, `property_manager`, `finance_officer`, `finance_approver`, `leasing_officer`, `caretaker`, `maintenance_coordinator`, `member`, `viewer`) → user is `owner` there while remaining `owner` of their Landlord org → per-org nav and permissions, switcher bounces between them. Phase 2 then connects the two with a `PropertyManagementAgreement` — both orgs already exist, nothing is re-platformed.
- **C — Admin provisions a user**: People → Add member (name, email, roles) → user created with membership + roles → logs in and sees only that org's world.
- **D — Role administration**: Roles page → custom role from permission matrix → assign to member → change takes effect server-side immediately (cache invalidation).
- **E — Denials**: org A admin probing org B's members/roles → 403/404; member without `role.assign` hitting the assign endpoint → 403; demoting the last owner → rejected.

#### 1.3 What gets built (inventory)

**Schema & seed** (`packages/database`)
- `OrganizationKind` enum, `Organization.kind`, `Role.isTemplate`, `Session.organizationId` → relation to `Organization` + membership validation, `User.onboardingCompletedAt`
- Partial unique index `roles(slug) WHERE organization_id IS NULL`
- Kind-template seeder (`org-role-templates.ts`) invoked on org creation; updated foundation seed

**Services** (`packages/database/src`)
- `OrgRoleService` — list/create/update org roles, set permission replace-set; **system + template roles non-deletable** (only custom roles deletable); template permissions editable by owner
- `MembershipService` — list members (paged, search, roles), create-user-with-roles (auto temp password shown once; must change on first login), status changes, add/remove roles with guards:
  - target role must be system or same-org
  - privilege ceiling: cannot assign a role whose permissions exceed the actor's
  - **last-owner protection**: cannot remove/demote/suspend the final active member holding both `user.manage` and `role.manage`
- Fixed `PasswordAuthProvider.signUp` — user only, no org/role side effects
- `TenantService.listUserMemberships(userId)` for session/onboarding

**API** (`apps/web/app/api`) — all org routes via `protectRoute` (org from session, membership validated)

| Route | Method | Permission |
| --- | --- | --- |
| `/api/auth/signup` `login` `logout` `session` | — | public/authenticated; cookie set/cleared |
| `/api/auth/switch-organization` | POST | active membership required |
| `/api/auth/profile` `change-password` | PATCH/POST | authenticated |
| `/api/onboarding` | GET | memberships list |
| `/api/onboarding/organization` | POST | authenticated (creates org + seeds + activates) |
| `/api/onboarding/select` | POST | active membership required |
| `/api/permissions` | GET | `permission.read`-level (or authenticated, catalog is non-sensitive) |
| `/api/roles` | GET/POST | `role.read` / `role.manage` |
| `/api/roles/[id]` | GET/PATCH/DELETE | `role.read` / `role.manage` |
| `/api/members` | GET/POST | `user.read` / `user.create`+`membership.invite` |
| `/api/members/[id]` | PATCH | `membership.manage` |
| `/api/members/[id]/roles` (+`/[roleId]`) | POST/DELETE | `role.assign` / `role.revoke` |

**Proxy** (`apps/web/proxy.ts` — Next 16 renamed middleware→proxy; optimistic checks only per Next docs)
- Cookie presence redirects: no session → `/login`; session but no membership → `/onboarding`; matcher on app routes
- **Real enforcement stays in `protectRoute` + server layouts** — proxy is never the security boundary

**UI** (`apps/web`)

```
app/
  onboarding/page.tsx            ← join-list OR kind cards (design.json onboarding pattern)
  (app)/layout.tsx               ← auth+org server check; Sidebar desktop / Sheet mobile;
                                    org switcher (all memberships, per-org role badges), user footer
  (app)/overview/page.tsx        ← rebuilt dashboard (stat-row placeholders)
  (app)/people/page.tsx          ← ResponsiveDataListing members; Add-member dialog; role assign/revoke
  (app)/roles/page.tsx           ← role list (System/Template/Custom badges); permission matrix editor
```

Mobile: sheet nav, members as cards, matrix as grouped accordions, ≥44px targets, bottom toasts.

**Tests**
- Template matrices per kind; last-owner guard; privilege ceiling; cross-org role assignment denial; cookie/session/switch flow; existing authorization suite updated (remove stale expectations)

#### 1.4 Build order (each increment ends green: typecheck + lint + build)

1. **Schema & seed** — `OrganizationKind`, `Organization.kind`, `Role.isTemplate`, `Session` relation, `onboardingCompletedAt`, partial unique index; kind-template seeder; `db push`/migrate + regenerate.
2. **Cookie auth** — signUp → user only; cookie set/clear; session/switch/profile/change-password endpoints; `proxy.ts` presence redirects; fix `lib/auth.ts` (`TenantService`, cookie-based context).
3. **Role & membership services** — `OrgRoleService`, `MembershipService` + guards; unit tests (incl. multi-org negatives).
4. **Onboarding API** — org create + seed + activate; join/select; acceptance journeys A/B.
5. **Admin APIs** — roles/members/permissions routes behind `protectRoute`; audit entries.
6. **UI** — shell → onboarding → overview → roles (matrix) → people; mobile pass at 375px.
7. **Hardening** — authorization suite refresh, cross-org + escalation tests, full acceptance checklist run.

#### 1A — Identity & session foundation

- [ ] **Signup creates `User` only** — remove the auto-org + empty-`owner` role creation (`password-provider.ts:204-240`).
- [ ] **httpOnly cookie sessions**: login/signup set `session` cookie (httpOnly, Secure in prod, SameSite=Lax, path=/). Client `AuthAPI` gets state from `/api/auth/session` only. Add `apps/web/proxy.ts` (**Next 16 renamed middleware → proxy**; optimistic presence checks only — no DB in proxy): unauthenticated → `/login`; authenticated but no membership → `/onboarding`. Real enforcement remains in `protectRoute` + server layouts.
- [ ] **Org context**: `Session.organizationId` relation + active-membership validation; `active-organization` cookie switched via `POST /api/auth/switch-organization`.
- [ ] **Wire `TenantService`** in `apps/web/lib/auth.ts`; audit auth events and org switches.

#### 1B — Onboarding & organization kinds

- [ ] Schema: `enum OrganizationKind { LANDLORD PROPERTY_MANAGEMENT MAINTENANCE_COMPANY MARKETING_AGENT }` + `Organization.kind` (nullable for legacy orgs) + `Role.isTemplate` (template roles protected from delete) + `User.onboardingCompletedAt` (or org-membership-derived completion).
- [ ] `POST /api/onboarding`: create organization by kind **or** list/join existing memberships.
- [ ] **Kind role-template seeder** — org-scoped template roles (`isTemplate: true`, non-deletable, permissions editable by owner) seeded on org creation, built from the existing 45 permission keys; Phase 2 later layers domain keys onto the same templates:
  - `LANDLORD` → `owner` (full org control), `manager` (ops + members, no finance deletion), `viewer` (read-only)
  - `PROPERTY_MANAGEMENT` → maps to the system-role matrix: `owner`, `admin`, `manager`, `member`, `viewer`
  - `MAINTENANCE_COMPANY` → `owner`, `coordinator` (jobs + technicians), `technician` (assigned work only), `viewer`
  - `MARKETING_AGENT` → `owner`, `marketing_agent` (markets properties, captures tenant leads, hands them off to landlord/PM), `viewer`
- [ ] `/onboarding` page (mobile-first per `design.json.patterns.onboarding`): if the user already has memberships, show them to **pick one active workspace** (rest reachable via the shell switcher); otherwise kind-selection cards → create org + seed + activate → redirect to Overview.
- [ ] **Anytime org creation (multi-kind growth)**: same create-org flow + seeder exposed **outside** onboarding — shell switcher "＋ New organization" and Settings → Organizations. A Landlord owner can stand up a PM/Maintenance company later; creator becomes that org's `owner`. Seeder is idempotent per org, so double-invocation is safe.

#### 1C — Role & membership services + API (`@workspace/database` → `apps/web/app/api`)

- [ ] **Deletion rule (confirmed): system AND template roles are both non-deletable. Only custom roles are deletable.** `OrgRoleService` handles list/create/update of org roles + permission replace-set; template permissions editable by owner, system role permissions editable only via seed/platform admin.
- [ ] `MembershipService` — list members (paged/search); **create-user-with-roles in one flow**: auto-generated temp password returned once to the admin to pass out-of-band; new user must change it on first login. Activate/suspend/remove; assign/revoke roles.
- [ ] Guards: **cannot remove/demote the last active owner**; **cannot grant a permission you do not hold**; **cannot assign a role you do not hold**; **role assignment validates `role.organizationId ∈ { null, membership.organizationId }`** (blocks cross-org roles).
- [ ] Migration: partial unique index `roles (slug) WHERE organization_id IS NULL`; all queries scoped by `organizationId` from auth context.
- [ ] Routes (all via `protectRoute`):
  - `GET/POST /api/roles`, `GET/PATCH/DELETE /api/roles/[id]` — `role.read` / `role.manage`
  - `GET /api/permissions` — catalog grouped by resource (matrix source)
  - `GET/POST /api/members`, `PATCH /api/members/[id]` — `user.read` / `membership.invite|manage`
  - `POST/DELETE /api/members/[id]/roles` — `role.assign` / `role.revoke`
  - `POST /api/onboarding`, `POST /api/auth/switch-organization`, `PATCH /api/auth/profile`, `POST /api/auth/change-password`
- [ ] Audit `role.*`, `membership.*`, org creation, org switches via `AuditLog` (actor, org, before/after).

#### 1D — UI (mobile-first, `design.json` patterns)

- [ ] **App shell**: `app/(app)/layout.tsx` — desktop sidebar (280px: brand **SisoHome**, ⌘K search, MENU, HELP, user footer) + mobile hamburger `Sheet`; nav filtered with `hasUiPermission`.
- [ ] **Onboarding page** outside the shell: join-list or kind cards (Landlord / Property Management / Maintenance Company), one primary CTA, identical at 375px.
- [ ] **People page**: `ResponsiveDataListing` (members table → mobile cards), create-user-with-roles dialog, per-member role assign/revoke.
- [ ] **Roles page**: role list, create/edit dialog, **permission matrix** grouped by resource (checkbox groups on desktop → accordions on mobile), template/system roles non-deletable.
- [ ] **Overview**: rebuild `/dashboard` inside the shell (placeholder metrics OK; real metrics come with finance).
- [ ] Pair every privileged control with a server check (client `PermissionGuard` is UX only).

#### Acceptance (merge gate for Phase 1)

- [ ] Signup → user only → login → redirected to `/onboarding` with zero permissions.
- [ ] Onboarding: create a **Landlord** org → kind roles seeded → creator holds the kind's `owner` template role with working permissions → lands on Overview. Repeat verified for Property Management and Maintenance Company kinds.
- [ ] **Seeder accuracy**: CI test asserts the exact template slug set per kind (LANDLORD: `owner,manager,viewer`; PROPERTY_MANAGEMENT: `owner,admin,property_manager,finance_officer,finance_approver,leasing_officer,caretaker,maintenance_coordinator,member,viewer`; MAINTENANCE_COMPANY: `owner,admin,coordinator,technician,viewer`; MARKETING_AGENT: `owner,marketing_agent,viewer`) and their Phase-1 permission grants.
- [ ] **Multi-kind growth (key journey)**: one user simultaneously holds a Landlord org (`owner`) and a Property Management Company org (`owner`) created later via "＋ New organization" — per-org nav/roles/permissions never blend; switcher bounces between both; PM org shows its full business role set.
- [ ] Onboarding: user with existing membership sees those orgs and can join/select them.
- [ ] Cookie session: no token in JS-readable storage; refresh keeps session; `proxy.ts` (optimistic) + `protectRoute` (real) enforce unauthenticated `/dashboard` and forces `/onboarding` for org-less users; org switch works.
- [ ] Admin creates a user with roles in one flow; that user logs in with exactly those permissions (enforced server-side, not just hidden in UI).
- [ ] Custom role with a permission subset works: holder allowed **only** those actions.
- [ ] Cross-org isolation: org A member gets 403/404 on org B roles/members (test); cannot assign org B's roles.
- [ ] Privilege escalation blocked: no `role.manage` ⇒ cannot assign roles; cannot grant/assign beyond own holdings; last owner cannot be demoted/removed.
- [ ] Mobile at 375px: onboarding cards, shell via sheet, members as cards, matrix usable, all targets ≥44px.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` green; authorization tests updated and passing (incl. new negatives).

### Phase 2 — Property & tenancy foundation (`sisohome-1.md` Steps 2–3)

`Property` (+ `portfolioOrganizationId`), `PropertyOwnership`, `PropertyManagementAgreement`, `Building`, `UnitType`, `Unit`, `PropertyStaffAssignment`, `Tenant` (separate from `User`), `Lease`/`LeaseTenant`/`LeaseUnit`, `LeaseDocument`/`DocumentVersion` (private object storage). Seed domain permission keys (`property.*`, `lease.*`, `tenant.*`) and **enrich the Phase 1 kind role templates** (landlord → `owner`/`manager`/`viewer`; property management → `owner`/`admin`/`property_manager`/`finance_officer`/`finance_approver`/`leasing_officer`/`caretaker`/`maintenance_coordinator`/`member`/`viewer`; maintenance → `owner`/`admin`/`coordinator`/`technician`/`viewer`) — **no competing role tables, no renames**; existing RBAC remains the only authorization system.

Acceptance: landlord owns a portfolio; a management company accesses **only** properties under a valid agreement; one tenant holds multiple leases; signed agreements stay private and versioned.

### Phase 3 — Finance & operations (`sisohome-1.md` Step 4)

`RentCharge`, `Payment` (+ idempotent provider callbacks), `PaymentAllocation`, deposit ledger, `Expense` + `ExpenseApproval` (approval ≠ payment ≠ recording, separate events), maintenance tickets → work orders → assignments/visits. `Decimal` money, explicit currency, owner reporting from authoritative records.

### Phase 4 — Services & portals (`sisohome-1.md` Step 5)

`ServiceProvider`/`ServiceAgreement`/`ServiceSchedule`/`ServiceVisit`, `UtilityBill` + explicit allocations, provider/technician portals, tenant portal, M-Pesa + reconciliation, notifications (WhatsApp), statements.

---

## 4. RBAC decisions (from `sisohome-1.md` §5 — binding for all phases)

1. **One RBAC only** — existing `Role`/`Permission`/`OrganizationMember*` stay the authorization foundation. No `PropertyRole`/`TenantRole`/`ProviderRole`.
2. Authorization flow on every sensitive action: authenticate → resolve active org → check permission → confirm resource relationship → check agreement/assignment validity → business rules (limits, separation of duties) → audit.
3. Authorization = permission **and** resource relationship (management agreement, assignment, tenancy) — membership alone is never enough.
4. `ResourceRelationship` is a helper, **not** the authoritative record of ownership/management contracts.
5. UI hiding (`hasUiPermission`) is UX only; `platform.admin` bypass is intentional and stays. Server always re-checks.

## 5. Conventions & commands

```bash
pnpm --filter web typecheck      # tsc --noEmit
pnpm --filter web build          # full Next build (runs typecheck)
pnpm --filter web lint
pnpm --filter @workspace/database db:seed     # permissions + system roles
pnpm --filter @workspace/database db:generate # after schema changes
```

- **Mandatory skills**: `.agents/skills/workspace-ui/SKILL.md` before any UI; `.agents/skills/multi-tenant-auth/SKILL.md` + `packages/database/.agents/skills/authorization/SECURITY_SKILL.md` before any data/route work.
- Tenant invariant: every query touching org data carries explicit `organizationId`; delete is restrictive for domain history; sensitive actions land in `AuditLog`.
- Update this document when a phase's scope or acceptance changes.

## 6. Decisions (recorded) & remaining opens

### Recorded (confirmed)

1. **Signup/onboarding** — signup creates the account only; a post-signup step lists organizations to join or creates a new org by kind (Landlord / Property Management / Maintenance Company); org creation auto-seeds that kind's role templates and assigns the creator the kind's `owner` template role.
2. **Session transport** — httpOnly cookie (+ `proxy.ts` optimistic checks; `protectRoute` is the real boundary).
3. **Invitations (first build)** — admin creates user + assigns roles immediately; email invites deferred to Phase 4.
4. **Brand** — SisoHome, same design language as the PrimeStay mockups.
5. **Initial password** — auto-generated temp password shown once to the admin (out-of-band); user must change it on first login.
6. **Role deletion** — template roles AND system roles are both non-deletable; only custom roles are deletable. Template permissions stay editable by owner.
7. **Multi-org onboarding** — user with existing memberships picks one active workspace at onboarding; all other orgs stay reachable through the shell switcher.

### Still open (decide during Phase 1)

- **Schema migration strategy** for Phase 1 changes — `prisma migrate dev` (versioned, recommended) vs `db push`.
- **Logo/brand asset** for the shell (mockups use a PrimeStay mark).
- **Multi-org join semantics** — when a user is associated with several orgs during onboarding, join all vs. pick one active workspace (switcher supports the rest).
