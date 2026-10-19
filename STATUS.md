# STATUS.md — Living Project State

**The session-agnostic source of truth for what exists right now, what's verified, what's broken, and where every other document lives.**

Rules for this doc (extend, don't rewrite):
- Read it at the **start** of any session; update the snapshot + tables at the **end** of every work block, committed together with the work.
- Other docs own *scope* (`BUILD.md`), *reuse* (`ADOPTION.md`), *domain design* (`property.md`), *rules* (`AGENTS.md`) — **this doc owns "current state"** and links to all of them.
- No secrets, no environment values — only key names. Repo-relative paths only.
- Add rows to the tables; don't delete history unless it's factually superseded (mark it so).

Snapshot: **2026-10-19 19:03** · branch `main` @ `40ccd27` · working tree clean

---

## 1. Doc map — where knowledge lives

| Document | Owns |
| --- | --- |
| **`STATUS.md` (this file)** | Current state, verification status, blockers, operating playbook, links |
| `AGENTS.md` | Mandatory rules injected into *every* session (auth security, UI system, Next.js). Points here |
| `BUILD.md` | What we're building, in what order, acceptance gates (single source of scope) |
| `ADOPTION.md` | How to reuse this foundation for other verticals (retail, wholesale…) + effort table |
| `property.md` | Phase-2 property-domain design (property/unit/lease/ledger model decisions) |
| `db.md` | *(empty — reserved)* |
| `packages/database/FOUNDATION_SUMMARY.md` | Authorization foundation — **partially historical**; where it conflicts with `AGENTS.md` (route protection), **AGENTS.md wins** |
| `packages/database/SECURITY.md` · `AUTH_ARCHITECTURE.md` · `INTEGRATION_GUIDE.md` | Deep auth/security reference for the database package |
| `siso-design/design.json` | Design system source for `apps/web` UI |
| `README.md` | Upstream template boilerplate (not project-specific) |

## 2. Apps & packages

| App | Purpose | Dev port | State |
| --- | --- | --- | --- |
| `apps/web` | SisoHome property product (Phase 1 complete) | **3000 intended** — currently running on fallback **3001** (see blockers) | Built, verified |
| `apps/sisohome-admin` | Full duplicate of `web` = cross-vertical template (per `ADOPTION.md`) | **3001** (`next dev --port 3001`) | Committed `777c74b`, typecheck ✓, lint 0 errors, boots `/login` 200 |

Packages: `@workspace/database` (schema, Prisma, access/tenancy layer, seeders), `@workspace/ui` (99 components + `UniversalForm`), `@workspace/auth-ui`, `@workspace/email` (template engine; copy lives in each app), plus configs.

## 3. What is built & verified

### Phase 1 — complete
Auth (signup → email verification → login → sessions, password reset/change, login alerts) · 2FA (TOTP + email code + recovery codes) · People management (invite, temp password, status, role assignment) · Roles & permissions editor with matrix · Settings/profile (email immutable) · org switcher, single-org rule for ownership roles (`SINGLE_ORG_ROLE_SLUGS`) · mobile shell (bottom tab bar, sheet nav) · PWA (manifest + sw) · Terms/Privacy pages · onboarding + org creation with kind picker.

### Security & authorization hardening — all committed, all smoked
| Batch | Commit | Verified |
| --- | --- | --- |
| `apiRoute` — single permission-checked route constructor | `2b2675b` (+ `37ca9c8` `7c29efc` `ba2ddda` `5a3cb92` cleanup) | apiroute E2E 14/14 |
| Crypto session tokens + sliding renewal | `6a928b0` | security E2E (expiry slide ✓) |
| Rate limiting on all auth endpoints | `85faf61` | security E2E (11th → 429 + Retry-After) |
| Immediate permission-cache invalidation + sibling-session revocation | `9602c1e` | security E2E (perms 5→0 instantly; sibling dead) |
| Versioned Terms/Privacy consent (DB model + enforcement) | `30ed037` `24015d1` `00138b4` `5950bf9` | consent E2E 8/8 sections |

### Verification status (last run 19:00, 2026-10-19)
- `pnpm --filter web typecheck` + `lint` → 0 errors / **3 warnings** (baseline) ✓
- `pnpm --filter sisohome-admin typecheck` + `lint` → 0 errors / 3 warnings ✓
- `pnpm --filter @workspace/auth-ui` typecheck+lint → 0/5 baseline ✓ · `@workspace/email` clean ✓ · `npx tsc -p packages/database` ✓ · `packages/ui` 0/48 baseline ✓
- All 6 E2E smokes passed **against the recovered scripts** (19:00, run with `BASE=http://localhost:3001` since web fell back — see blocker #1/#2): **consent 8/8, verify 10/10, 2FA 11/11, email 12/12, apiroute 14/14, security 5/5**. DB residue after runs: 0 smoke users · 0 smoke orgs · 0 consent rows

## 4. Operating playbook

**Dev server** (one `next dev` per app dir; only one instance survives; log to a file):
```bash
cd apps/web && (setsid pnpm dev > /tmp/opencode/dev-server.log 2>&1 &) ; sleep 14
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login   # expect 200
```
⚠ Next silently falls back to another port if busy — always check the log for `Port 3000 is in use`. Never `pkill -f "next dev"` while your own shell command contains that string (it matches itself); kill by PID.

**Verify before commit:** the typecheck/lint commands above. Never `pnpm build`.

**Database** (live remote Prisma Postgres):
```bash
cd packages/database && set -a && source .env && set +a
npx prisma db push        # repo convention (no migration SQL)
npx prisma generate       # db push does NOT regenerate — do both; then restart dev servers
```
Smoke runs must leave zero smoke users/orgs/consent rows; helper `src/seed/__smoke-db.ts` (cascades user but NOT org — delete orgs by name separately).

**Rate limits** are in-process memory → reset on dev-server restart; 6 smokes fit within them by design.

**Email** in dev = outbox (`EMAIL_TRANSPORT=outbox`), cwd-relative `.email-outbox/` → each app writes its own dir; mail templates are rendered in-app under `apps/<app>/lib/email/`.

**E2E smokes** live in-repo at `packages/database/smoke/` (6 scripts; recovered 2026-10-19 — see §5.1):
```bash
BASE=http://localhost:3000 bash packages/database/smoke/smoke-<name>-e2e.sh   # names: consent, verify, 2fa, email, apiroute, security
```
They self-clean users+orgs, read the dev outbox, and fit within rate limits; run them one at a time. `BASE` is honored everywhere (verify/email page-fetches follow mail links on `$BASE`).

**Code search** — semantic index via `ccc` (skill `.agents/skills/ccc`, installed 2026-10-19 with `uv tool install 'cocoindex-code[full]'`): `ccc search "<concept>"`; after significant code changes run `ccc index` (settings in `.cocoindex_code/`, gitignored; 627 files / 4897 chunks indexed).

**Scripts:** `apps/web/scripts/__smoke-token.ts` (TOTP/OTP helper), `packages/database/src/seed/__smoke-db.ts` (session-expiry/set-session-expiry/consents), `packages/database/src/seed/__smoke-del-user.ts` (cascade delete one smoke user; orgs must be deleted separately).

## 5. Open items & blockers

1. ~~**E2E smoke scripts lost**~~ **RESOLVED 19:00, 2026-10-19.** `/tmp/opencode` had been wiped; all six scripts were reconstructed verbatim by replaying every `write`/`edit`/bash-patch from opencode's session DB (`opencode.db` → `part.data`, strict chronological replay — the apiroute 20:21 `sed` was a no-op in the original too, so it was omitted) and committed to **`packages/database/smoke/`**. All 6 re-passed end-to-end afterwards. Two one-line portability patches added (`PAGE_URL` host rewrite in verify + email so page-fetches honor `BASE`; identical behavior on :3000). **Lesson: never store durable work in `/tmp`.**
2. **Port 3000 conflict.** The user's `tijwa-invoice-app` (PID 85579, started 11:37) still holds 3000 at 19:03; `web` fell back to 3001 (PID 186179); `sisohome-admin` is *configured* for 3001 → collision pending. Plan: user stops invoice-app → restart `web` on 3000 → admin keeps 3001. Smokes default to `localhost:3000` (override with `BASE=`).
3. **Accepted security leftovers** (audited, not approved for fixing): `admin` template role lacks `role.manage`; dead `PolicyEngine`; no auth-event audit trail; no org-enforceable MFA; plaintext temp passwords; consent gate for pre-existing users deferred to next password change (approved).
4. **`FOUNDATION_SUMMARY.md` staleness** — claims "no business-specific seed data" (now 4 kind templates) and unwired `protectRoute` (use `apiRoute`/`requireAuth`). Not yet edited.
5. **`db.md` empty**; `README.md` still upstream template boilerplate.
6. **Known kind work**: `OrganizationKind` = LANDLORD, PROPERTY_MANAGEMENT, MAINTENANCE_COMPANY, MARKETING_AGENT; templates in `src/seed/org-kind-templates.ts`; 45 permission keys in `src/seed/foundation-permissions.ts`; extension steps documented in `ADOPTION.md` §2.

## 6. Recent commits (tip of `main`)

```text
40ccd27 docs: STATUS.md living state doc + AGENTS.md pointer
777c74b chore: add sisohome-admin app as cross-vertical template
9749ad0 docs: foundation adoption guide for other verticals
5950bf9 chore(database): smoke helper inspects consent rows
00138b4 feat(web): enforce versioned Terms/Privacy consent
24015d1 feat(auth-ui): consent state plumbing
30ed037 feat(database): versioned user-consent model
542bee5 chore: smoke helpers — TOTP token generator + session DB inspector
9602c1e fix: immediate permission-cache invalidation + sibling session revocation
85faf61 feat(web): rate limiting on auth endpoints
6a928b0 fix(database): crypto-strong session tokens + sliding renewal
2b2675b feat(web): apiRoute — single permission-checked route constructor
```
