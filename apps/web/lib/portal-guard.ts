/**
 * Portal guard — session → portal-tenant resolution for `/api/portal/*`.
 *
 * Design (plan-slice-7 §1.2, option A — relationship-based, no permission
 * keys): portal access is proven by the TENANT ROW, never by roles.
 *
 *   session.userId → Tenant.findMany({ portalUserId, portalStatus: 'ACTIVE' })
 *     none   → 403 'No portal access'
 *     one    → implicit context
 *     many   → signed `siso_portal_tenant` context cookie (HMAC with
 *              PORTAL_CONTEXT_SECRET, fail-closed) — the chosen id is still
 *              re-verified to belong to this user's active tenants on every
 *              request, so a forged/stale cookie can never cross tenants.
 *
 * Dual-role users (org member + tenant) are fine: `requireAuth` runs with
 * `requireOrganization: false` and org context is NEVER read here — portal
 * queries filter by `tenantId` only. `mustChangePassword` still blocks
 * (requireAuth's shared check).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/auth';
import { ok } from '@/lib/api-route';
import {
  getRouteAuthContext,
  mapRouteError,
  requireAuth,
  RouteAuthContext,
  RouteError,
} from '@/lib/route-auth';

export const PORTAL_TENANT_COOKIE = 'siso_portal_tenant';

const CONTEXT_TTL_SECONDS = 60 * 60 * 24 * 7; // mirrors the session cookie

/** Minimal tenant row for guard + picker — no PII beyond the name. */
export interface PortalTenantRef {
  id: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
}

/** Tenant-scoped actor handed to portal domain functions. */
export interface PortalTenantActor {
  userId: string;
  /** Resolved, ownership-verified tenancy — every read filters by this. */
  tenantId: string;
  /** The tenant's capturing org — display/audit only, never a query scope. */
  organizationId: string;
}

// ── context cookie (signed) ──────────────────────────────────────────────────

function hmac(value: string): string {
  const secret = process.env.PORTAL_CONTEXT_SECRET;
  if (!secret) throw new Error('PORTAL_CONTEXT_SECRET is not configured');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signContext(tenantId: string): string {
  return `v1.${tenantId}.${hmac(tenantId)}`;
}

/** Returns the tenantId only when the signature is intact (timing-safe). */
export function verifyPortalContext(value: string | undefined | null): string | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, tenantId, sig] = parts;
  if (!tenantId || !sig) return null;
  const expected = Buffer.from(hmac(tenantId));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return tenantId;
}

export function setPortalContextCookie(response: NextResponse, tenantId: string): void {
  response.cookies.set(PORTAL_TENANT_COOKIE, signContext(tenantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CONTEXT_TTL_SECONDS,
  });
}

export function clearPortalContextCookie(response: NextResponse): void {
  response.cookies.set(PORTAL_TENANT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readPortalContext(request: NextRequest): string | null {
  return verifyPortalContext(request.cookies.get(PORTAL_TENANT_COOKIE)?.value);
}

// ── tenant resolution ────────────────────────────────────────────────────────

/** All ACTIVE portal tenants owned by this user (may span several orgs). */
export async function resolvePortalTenants(userId: string): Promise<PortalTenantRef[]> {
  const rows = await db.tenant.findMany({
    where: { portalUserId: userId, portalStatus: 'ACTIVE' },
    select: {
      id: true,
      displayName: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
    orderBy: { displayName: 'asc' },
  });
  return rows.map((t) => ({
    id: t.id,
    displayName: t.displayName,
    organizationId: t.organizationId,
    organizationName: t.organization.name,
  }));
}

/**
 * Pick the request's tenant: the signed context cookie when >1 tenancy,
 * otherwise the single active tenancy. Invalid/stale cookies fall back to
 * "context required" (the session route re-binds the default).
 */
function pickTenant(
  request: NextRequest,
  tenants: PortalTenantRef[],
): PortalTenantRef {
  const only = tenants[0];
  if (tenants.length === 1 && only) return only;
  const claimed = readPortalContext(request);
  const match = claimed ? tenants.find((t) => t.id === claimed) : undefined;
  if (match) return match;
  throw new RouteError(409, 'Tenant context required', { needsContext: true });
}

export interface PortalRouteArgs<P = Record<string, string>> {
  request: NextRequest;
  ctx: RouteAuthContext;
  /** Ownership-verified actor — filter every query by `tenantId`. */
  actor: PortalTenantActor;
  /** The user's active tenancies (for multi-tenant responses). */
  tenants: PortalTenantRef[];
  params: P;
  body: <T = Record<string, unknown>>() => Promise<T>;
  query: URLSearchParams;
}

export interface PortalRouteOptions<P> {
  handler: (
    args: PortalRouteArgs<P>,
  ) => Promise<NextResponse | Record<string, unknown> | void>;
}

/**
 * The `apiRoute` twin for portal endpoints: session required, NO active-org
 * requirement, NO permission keys (relationship-based by design), then the
 * tenant context resolved and verified. Errors map like `apiRoute`.
 */
export function apiRoutePortal<P extends Record<string, string> = Record<string, string>>(
  options: PortalRouteOptions<P>,
) {
  const { handler } = options;

  return async (
    request: NextRequest,
    routeCtx?: { params: Promise<unknown> },
  ): Promise<NextResponse> => {
    try {
      const ctx = await requireAuth(request, { requireOrganization: false });

      const rawParams = routeCtx?.params ? ((await routeCtx.params) ?? {}) : {};
      const params = Object.fromEntries(
        Object.entries(rawParams as Record<string, unknown>).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : '',
        ]),
      ) as P;

      let parsedBody: unknown;
      let bodyParsed = false;
      const body = async <T = Record<string, unknown>>(): Promise<T> => {
        if (!bodyParsed) {
          parsedBody = await request.json().catch(() => ({}));
          bodyParsed = true;
        }
        return parsedBody as T;
      };

      const tenants = await resolvePortalTenants(ctx.userId);
      if (tenants.length === 0) {
        throw new RouteError(403, 'No portal access');
      }
      const tenant = pickTenant(request, tenants);

      const result = await handler({
        request,
        ctx,
        actor: {
          userId: ctx.userId,
          tenantId: tenant.id,
          organizationId: tenant.organizationId,
        },
        tenants,
        params,
        body,
        query: request.nextUrl.searchParams,
      });

      if (result instanceof Response) return result as NextResponse;
      if (result == null) return ok();
      return ok(result);
    } catch (error) {
      return mapRouteError(error);
    }
  };
}

/**
 * Session-shaped helper for non-tenant-context routes (`GET /api/portal/
 * session`, `POST /api/portal/switch-tenant`): auth only — the caller
 * resolves tenants itself (the guard would 409 before a choice exists).
 */
export async function requirePortalSession(
  request: NextRequest,
): Promise<RouteAuthContext> {
  return requireAuth(request, { requireOrganization: false });
}

export { getRouteAuthContext };
