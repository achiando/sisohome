/**
 * The single constructor for protected API route handlers.
 *
 * Every org-scoped route in apps/web is declared with `apiRoute`, which
 * composes the real enforcement layer (`requireAuth` in route-auth.ts):
 *
 *   - resolves the `siso_session` cookie to an identity
 *   - blocks sessions that still must change their password
 *   - requires an active organization (unless opted out)
 *   - checks PERMISSION KEYS — never role slugs
 *   - maps AuthGuardError / AccessError to JSON with the right status
 *
 * The handler receives a ready-made context: the session context, an
 * `actor` with a non-null organizationId for service calls and Prisma
 * scoping, awaited route `params`, and a cached JSON `body` parser.
 *
 *   export const POST = apiRoute<{ id: string }>({
 *     permissions: 'role.assign',
 *     async handler({ actor, params, body }) {
 *       const { roleIds } = await body<{ roleIds: string[] }>();
 *       await membershipService.assignRoles(actor, params.id, roleIds);
 *       return { success: true };            // wrapped as 200 JSON
 *     },
 *   });
 *
 * Throw `new RouteError(404, 'Role not found')` (or any error carrying a
 * numeric `status`, e.g. AccessError) for failures; return a NextResponse
 * from `ok()`/`fail()` for full control.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  mapRouteError,
  requireAuth,
  RouteAuthContext,
  RouteError,
} from './route-auth';

export { RouteError, mapRouteError };

/** Non-null actor for service calls and tenant-scoped queries. */
export interface ApiActor {
  userId: string;
  organizationId: string;
}

export interface ApiRouteArgs<P = Record<string, string>> {
  request: NextRequest;
  /** Raw session context (organizationId may be null when requireOrg: false). */
  ctx: RouteAuthContext;
  /** Convenience actor: organizationId is non-null (route requires an org). */
  actor: ApiActor;
  /** Awaited dynamic route params, e.g. { id: '…' }. */
  params: P;
  /** Parsed-once JSON body; {} on empty or malformed payloads. */
  body: <T = Record<string, unknown>>() => Promise<T>;
  /** Query-string search params. */
  query: URLSearchParams;
}

export interface ApiRouteOptions<P> {
  /** Permission keys the caller must hold in the active organization. */
  permissions?: string | string[];
  /** Reject sessions without an active organization (default true). */
  requireOrg?: boolean;
  handler: (
    args: ApiRouteArgs<P>,
  ) => Promise<NextResponse | Record<string, unknown> | void>;
}

/** Success response with optional status (default 200). */
export function ok(
  data?: Record<string, unknown>,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status: init?.status ?? 200 });
}

/** Failure response: { success: false, error } with an HTTP status. */
export function fail(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/**
 * Declare a protected route handler. Returns the function Next.js expects
 * (request, { params }?) — params are awaited and validated to strings.
 */
export function apiRoute<P extends Record<string, string> = Record<string, string>>(
  options: ApiRouteOptions<P>,
) {
  const {
    permissions,
    requireOrg = true,
    handler,
  } = options;
  const requiredPermissions = permissions == null
    ? []
    : Array.isArray(permissions)
      ? permissions
      : [permissions];

  return async (
    request: NextRequest,
    routeCtx?: { params: Promise<unknown> },
  ): Promise<NextResponse> => {
    try {
      const ctx = await requireAuth(request, {
        requiredPermissions,
        requireOrganization: requireOrg,
      });

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

      const result = await handler({
        request,
        ctx,
        actor: {
          userId: ctx.userId,
          organizationId: ctx.organizationId as string,
        },
        params,
        body,
        query: request.nextUrl.searchParams,
      });

      if (result instanceof NextResponse) return result;
      if (result == null) return ok();
      return ok(result);
    } catch (error) {
      return mapRouteError(error);
    }
  };
}
