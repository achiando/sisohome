import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/auth'
import { mapRouteError } from '@/lib/route-auth'
import {
  readPortalContext,
  requirePortalSession,
  resolvePortalTenants,
  setPortalContextCookie,
} from '@/lib/portal-guard'

/**
 * GET /api/portal/session — who am I in the portal, and which tenancies can
 * I pick? Drives the client-side portal shell guard:
 *   401 no session · 403 'No portal access' (no ACTIVE tenant rows) ·
 *   200 { tenants[], profile, contextTenantId }.
 *
 * Multi-tenant users get a default context cookie here when theirs is
 * missing/stale, so reads never 409 right after sign-in. No org context is
 * read — dual-role sessions are ordinary portal sessions.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await requirePortalSession(request)
    const tenants = await resolvePortalTenants(ctx.userId)
    const fallback = tenants[0]
    if (!fallback) {
      return NextResponse.json({ success: false, error: 'No portal access' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, displayName: true, mustChangePassword: true },
    })

    const current = readPortalContext(request)
    const validContext = current && tenants.some((t) => t.id === current) ? current : null

    const response = NextResponse.json({
      success: true,
      tenants: tenants.map((t) => ({
        id: t.id,
        displayName: t.displayName,
        orgName: t.organizationName,
      })),
      profile: {
        email: user?.email ?? ctx.email ?? null,
        name: user?.displayName ?? null,
        mustChangePassword: user?.mustChangePassword ?? false,
      },
      contextTenantId: validContext ?? fallback.id,
    })
    if (!validContext) setPortalContextCookie(response, fallback.id)
    return response
  } catch (error) {
    return mapRouteError(error)
  }
}
