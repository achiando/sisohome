# Foundation Adoption — Reusing SisoHome for Other Businesses

How easy is it to take what is built here and stand up **retail, wholesale, distribution, services**, or any other multi-tenant business on the same foundation?

| Source | Role |
| --- | --- |
| `FOUNDATION_SUMMARY.md` (packages/database) | The domain-agnostic authorization foundation (models, engine, tests) |
| `BUILD.md` | Sequencing and acceptance gates for *this* product (property vertical) |
| `ADOPTION.md` (this file) | What adapts for free, what the real per-vertical work is, and how much it costs |

**Verdict: the hard, safety-critical parts are already done and are business-agnostic. Adopting a new vertical is additive — new kind, new permission keys, new domain tables, new pages — never a rewrite.** The foundation (auth, multi-org RBAC, security hardening, UI system, email, consent) is the multi-month part and it ships as-is. What a new vertical costs is its *domain layer* — the equivalent of our Phase 2–3 — plus a day-scale integration checklist.

---

## 1. What you inherit for free (zero changes per vertical)

Everything below was built without any business-domain assumptions and is proven in production paths today.

| Capability | Where | Why it's vertical-agnostic |
| --- | --- | --- |
| **Auth**: signup → email verification → login → sessions, password reset, change-password, 2FA (TOTP + email + recovery codes), login alerts | `apps/web/app/api/auth/*`, `packages/auth-ui` | Talks only about Users, never about the business |
| **Security hardening**: crypto session tokens, sliding sessions, rate limiting (per-IP + per-account), sibling-session revocation, versioned consent (Terms/Privacy with IP + timestamp) | `lib/rate-limit.ts`, `lib/consent.ts`, `password-provider.ts` | Compliance and abuse controls are industry-independent |
| **Multi-org membership invariant**: one user → many orgs → different roles per org, one active workspace, org switcher | `OrganizationMember*` schema + `Session.organizationId` + `lib/route-auth.ts` | The core model has no domain tables in it |
| **RBAC engine**: `resource.action` permission keys, default-deny, `apiRoute` constructor, permission caches with immediate invalidation on role/membership change | `@workspace/database` authorization layer, `apps/web/lib/api-route.ts` | The 45 base keys (organization, user, membership, role, permission, resource, audit) describe *running an organization*, not an industry |
| **Defense in depth**: server-side permission checks + tenant-scoped queries + UI gating (`hasUiPermission`) + `proxy.ts` presence gate | AGENTS.md rules, enforced across every route | Same three layers regardless of what the domain tables are |
| **Audit trail**: actor/org/action/resource rows for every privileged mutation | `AuditLog` + `AuditService` | Generic by design |
| **UI system**: `@workspace/ui` (99 components), `UniversalForm`, `ResponsiveDataListing`, mobile shell (bottom tabs, sheet nav, switcher), theme token layer | `packages/ui`, `apps/web/app/theme.css`, `siso-design/design.json` | Components render generic lists/forms/cards; the vertical only changes labels and columns |
| **Email engine**: transactional templates rendered in-app (verification, reset, 2FA, login alert, invite, password expiry) + outbox/resend/smtp transports | `packages/email`, `apps/web/lib/email/*` | Copy is swappable; plumbing is not |
| **Admin foundations already solved**: people management, role editor with permission matrix, last-owner protection, privilege ceiling, single-org rule for ownership roles | `apps/web/app/(dashboard)/people|roles` | Every business needs exactly this |

Rule of thumb: **if a component talks about *who can do what, in which workspace*, it is foundation. If it talks about *the thing being sold/managed*, it is vertical.** The codebase keeps those layers strictly apart — which is exactly why adoption is cheap.

---

## 2. The adaptation surface — what actually changes per vertical

### 2.1 Organization kind (hours)

A vertical is first-class as an `OrganizationKind`. Today: `LANDLORD`, `PROPERTY_MANAGEMENT`, `MAINTENANCE_COMPANY`, `MARKETING_AGENT`.

Adding `RETAIL` / `WHOLESALE` touches:

| Step | File |
| --- | --- |
| 1. Enum value | `packages/database/prisma/schema.prisma` → `enum OrganizationKind` (+ `db push` + `prisma generate`) |
| 2. Role template table | `packages/database/src/seed/org-kind-templates.ts` → one entry in `KIND_TEMPLATE_ROLES` |
| 3. Kind card copy | `apps/web/app/create-organization/_components/kind-picker.tsx` (+ optional skip-step behavior in `create-organization-screen.tsx`) |
| 4. Seeder test row | same seeder test that asserts the exact slug set per kind — CI catches drift |

Everything else is automatic: `organization.service.ts` already invokes `seedOrgKindRoles(tx, orgId, kind)` on creation; the onboarding flow, switcher, "＋ New organization", permissions matrix, and People page need no changes.

### 2.2 Permission keys + role templates (hours–days)

- Base: the existing **45 generic keys** apply as-is (`owner` of a retail org gets the same org/user/role/audit powers as any other owner).
- Vertical keys follow the established enrichment pattern — **add to the seed, attach to the same template roles, never rename, never new tables** (this is exactly how Phase 2 layers `property.*` / `lease.*` onto today's templates):
  - Retail: `product.*`, `category.*`, `stock.*`, `sale.*`, `supplier.*`, `pos.*`
  - Wholesale: `catalog.*`, `price_list.*`, `purchase_order.*`, `customer.*`, `warehouse.*`, `credit.*`
  - Distribution/logistics: `shipment.*`, `route.*`, `fleet.*`, `delivery.*`
- Custom roles per customer org are already supported end-to-end (create → permission matrix → assign → immediate cache flush).

### 2.3 Domain schema (the real work — the Phase 2–3 equivalent)

This is the only genuinely *new* engineering per vertical, and it is additive: new models with `organizationId` + membership-scoped queries + `apiRoute`-guarded endpoints + pages built from existing components.

| Vertical | Domain models (examples) | Reuses directly |
| --- | --- | --- |
| Retail | `Product`, `Category`, `StockLevel`, `Sale`, `SaleLine`, `Supplier`, `PurchaseOrder` | People/roles pages, `ResponsiveDataListing` for catalog & sales, `UniversalForm` for product entry, audit, sessions |
| Wholesale | `Customer`, `PriceList`, `PriceTier`, `Quotation`, `SalesOrder`, `Warehouse`, `StockMovement` | same as retail + org switcher (branch warehouses as child orgs or locations — `OrganizationLocation` already exists) |
| Services | `Job`, `Quote`, `Schedule`, `Invoice` | maintenance-company template as the closest starting kind |

Ownership/tenant rules map 1:1: every table carries `organizationId`; cross-org reads stay denied by the same three layers; `ResourceRelationship` remains available for polymorphic links (who supplies what, who fulfills which order) exactly as it models property↔management↔owner today.

### 2.4 Nav, pages, copy (days)

- Nav labels + IA: `design.json` recipes (stat row, tabs, table/cards, kanban) already map to any list-heavy product; menu items filter by permission the same way.
- Pages: one listing page + one form + one detail screen per aggregate, composed from `@workspace/ui` — the patterns are established (People/Roles are the reference implementations).

### 2.5 Brand & email copy (hours)

- Rebrand = swap tokens in `apps/web/app/theme.css` (`--primary`, accent, semantic colors) + `design.json` values; components take colors from tokens only (enforced rule — no component hardcodes).
- Email templates are plain copy over shared layouts (`apps/web/lib/email/*`).

### 2.6 Legal & consent (hours, one-time)

- `/terms` + `/privacy` text; bump `lib/consent-versions.ts` → everyone is re-prompted at next password change; acceptance rows keep history.

---

## 3. Worked example — adding `RETAIL` end to end

```text
1. schema.prisma        enum OrganizationKind { … RETAIL }         ~1 line
2. db push + generate   (additive enum value)
3. org-kind-templates   KIND_TEMPLATE_ROLES.RETAIL =               ~1 table
      owner / store_manager / cashier / inventory_clerk / viewer
      with Phase-appropriate keys (base org keys now, product.*/stock.*/sale.* on seed growth)
4. seeder test          add expected slug set for RETAIL           ~3 lines
5. kind-picker          add the card (icon + one-line pitch)       ~10 lines
6. (when domain lands)   Product/Sale models + /catalog /sales pages,
                         apiRoute endpoints, nav entries           Phase-2-equivalent work
```

Steps 1–5 are the *entire* integration for the foundation to fully support the new kind — signup, onboarding, seeding, permissions, People, Roles, audit all light up with zero further changes. Step 6 is where the vertical's actual product lives; it follows the same build order as our Phase 2 (schema → seed keys → enrich templates → API → pages).

`WHOLESALE` is identical with a different template table (`owner / sales_manager / purchasing / warehouse_clerk / viewer`) and different domain models.

---

## 4. Effort summary

| Layer | Effort per new vertical | Notes |
| --- | --- | --- |
| Foundation (auth, RBAC, security, consent, UI kit, email, admin pages) | **Already paid** | Ships as-is; nothing re-verified per vertical |
| Org kind + templates + tests + kind card | **Hours** | 4 reference kinds to copy |
| Domain permission keys | **Hours–days** | Seed rows + attach to templates |
| Brand / email copy / legal | **Hours** | Token swap + copy |
| Domain schema + API + pages (the product itself) | **Weeks** | Same shape as our Phase 2–3; purely additive |
| **Total to a working vertical MVP** | **Foundation: 0 · Glue: ~1 day · Domain: the project** | |

---

## 5. What does NOT need touching per vertical

`apiRoute` / `route-auth`, `proxy.ts`, rate limiting, consent, 2FA, session lifecycle, caches + invalidation, audit plumbing, `ResponsiveDataListing`/`UniversalForm`/shell, email transports, smoke-test infrastructure, AGENTS.md enforcement rules. These are the parts that took the longest to make *correct* (see the security/authorization batches in git history) — and they are exactly the parts a vertical never sees.

## 6. Honest caveats

1. **Enum changes need `db push` + `prisma generate` + dev-server restart** — standard here, but it is a schema migration, not config.
2. **Kind cards are hardcoded UI copy** (`kind-picker.tsx`) — adding a kind means a small UI edit; there is no dynamic kind registry (not worth building until there are many kinds).
3. **Single-org rule** (`SINGLE_ORG_ROLE_SLUGS`, `role-policy.ts`) — ownership-style roles can only exist in one org per user; verify it still matches a vertical's semantics (it does for retail/wholesale owner/staff models).
4. **`FOUNDATION_SUMMARY.md` is partially historical** — where it and `AGENTS.md` disagree on route protection (`protectRoute` vs `apiRoute`), **`AGENTS.md` is authoritative**.
5. **Brand-per-tenant (white-labeling per customer org)** is not built — branding is currently single-tenant via `theme.css`; per-org theming would be a separate feature.
6. **Nav IA is property-flavored today** (Portfolio, Leasing, …) — labels swap cheaply, but expect a pass through the menu definitions per vertical.
