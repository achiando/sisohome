/**
 * Public intake endpoints — NO session (proxy allowlists `/api/intake`).
 *
 *   GET  /api/intake/[token]  → minimal property/unit context for the form
 *   POST /api/intake/[token]  → submit the applicant (tenant + application)
 *
 * Plain handlers (apiRoute requires auth). Errors map via `mapRouteError`:
 * invalid token → 404, expired/out-of-scope → 410, validation → 400,
 * duplicate live application → 409. Rate limits: 60/min per IP for context,
 * 10/10min per IP for submissions (inbox-flood / spam-post cap).
 */

import { type NextRequest, NextResponse } from 'next/server';

import { mapRouteError, RouteError } from '@/lib/api-route';
import { resolveIntake, submitIntake } from '@/lib/domain/intake';
import { checkRateLimits, ipKey } from '@/lib/rate-limit';

type RouteCtx = { params: Promise<{ token?: string }> };

export async function GET(request: NextRequest, routeCtx: RouteCtx): Promise<NextResponse> {
  try {
    const limited = checkRateLimits([
      { key: ipKey(request, 'intake:ctx'), limit: 60, windowMs: 60_000 },
    ]);
    if (limited) return limited;

    const { token } = await routeCtx.params;
    const context = await resolveIntake(token);
    return NextResponse.json({ success: true, ...context });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: NextRequest, routeCtx: RouteCtx): Promise<NextResponse> {
  try {
    const limited = checkRateLimits([
      { key: ipKey(request, 'intake:submit'), limit: 10, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const { token } = await routeCtx.params;
    const body = await request.json().catch(() => ({}));
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new RouteError(400, 'Invalid request body');
    }
    const result = await submitIntake(token, body as Record<string, unknown>);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return mapRouteError(error);
  }
}
