/**
 * Cookie-aware auth context + route protection for Next.js route handlers.
 *
 * The session token lives in an httpOnly cookie (`siso_session`). These
 * helpers resolve it to an AuthContext and enforce required permissions
 * server-side — the single real gate for every protected API route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService, authorizationService, db, tenantService } from './auth';
import { getSessionToken } from './auth';
import { setActiveOrgCookie } from './session-cookie';

export interface RouteAuthContext {
  userId: string;
  sessionId: string | null;
  organizationId: string | null;
  email?: string;
}

/**
 * Routes reachable while `mustChangePassword` is set: restoring/inspecting
 * the session, completing the forced change, and signing out. Everything
 * else (the whole business API) is blocked until a real password is set.
 */
const PASSWORD_CHANGE_EXEMPT_PATHS = new Set([
  '/api/auth/session',
  '/api/auth/change-password',
  '/api/auth/logout',
]);

/**
 * Resolve the authenticated context from the session cookie.
 * Returns null when there is no valid session.
 */
export async function getRouteAuthContext(
  request: NextRequest,
): Promise<RouteAuthContext | null> {
  const token =
    request.cookies.get('siso_session')?.value ?? (await getSessionToken());
  if (!token) return null;

  try {
    const identity = await authService.verifySession(token);
    return {
      userId: identity.userId,
      sessionId: identity.sessionId ?? null,
      organizationId: (identity.metadata?.organizationId as string | null) ?? null,
      email: identity.email,
    };
  } catch {
    return null;
  }
}

export interface RequireAuthOptions {
  /** Permissions the caller must hold in the active organization. */
  requiredPermissions?: string[];
  /** Reject when the session has no active organization (default true). */
  requireOrganization?: boolean;
}

/**
 * Guard a route handler. Throws (callers should wrap in try/catch and return
 * the mapped NextResponse) — or use `withAuth` below for a wrapper.
 */
export async function requireAuth(
  request: NextRequest,
  options: RequireAuthOptions = {},
): Promise<RouteAuthContext> {
  const { requiredPermissions = [], requireOrganization = true } = options;

  const context = await getRouteAuthContext(request);
  if (!context) {
    throw new AuthGuardError(401, 'Not authenticated');
  }

  // Forced password change: block every business API (except the session /
  // change-password / logout routes) until the temporary password is replaced.
  if (!PASSWORD_CHANGE_EXEMPT_PATHS.has(request.nextUrl.pathname)) {
    const user = await db.user.findUnique({
      where: { id: context.userId },
      select: { mustChangePassword: true },
    });
    if (user?.mustChangePassword) {
      throw new AuthGuardError(403, 'Password change required');
    }
  }

  if (requireOrganization && !context.organizationId) {
    throw new AuthGuardError(403, 'Organization context required');
  }

  if (requiredPermissions.length > 0 && context.organizationId) {
    const granted = await authorizationService.getUserPermissions(
      context.userId,
      context.organizationId,
    );
    const missing = requiredPermissions.filter((p) => !granted.includes(p as never));
    if (missing.length > 0) {
      throw new AuthGuardError(403, `Missing permissions: ${missing.join(', ')}`);
    }
  }

  return context;
}

export class AuthGuardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Wrap a route handler with authentication + permission checks. The handler
 * receives the resolved context. Errors map to JSON responses.
 */
export function withAuth<T extends (request: NextRequest, context: RouteAuthContext, ...rest: any[]) => Promise<NextResponse>>(
  handler: T,
  options: RequireAuthOptions = {},
) {
  return async (request: NextRequest, ...rest: any[]): Promise<NextResponse> => {
    try {
      const context = await requireAuth(request, options);
      return await handler(request, context, ...rest);
    } catch (error) {
      if (error instanceof AuthGuardError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.status });
      }
      // Service-layer errors (AccessError and friends) carry a status
      const status = (error as { status?: unknown })?.status;
      if (typeof status === 'number' && status >= 400 && status < 600) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'Request failed' },
          { status },
        );
      }
      console.error('Route error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Activate an organization on the current session + cookies (used by
 * onboarding and the org switcher).
 */
export async function activateOrganization(
  request: NextRequest,
  context: RouteAuthContext,
  organizationId: string,
): Promise<void> {
  const canAccess = await tenantService.canAccessOrganization(
    context.userId,
    organizationId,
  );
  if (!canAccess) {
    throw new AuthGuardError(403, 'Not a member of that organization');
  }

  if (context.sessionId) {
    const { db } = await import('./auth');
    await db.session.update({
      where: { id: context.sessionId },
      data: { organizationId },
    });
  }
  context.organizationId = organizationId;
}

export { setActiveOrgCookie };
