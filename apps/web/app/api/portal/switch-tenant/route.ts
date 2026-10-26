import { NextRequest, NextResponse } from 'next/server'

import { ok } from '@/lib/api-route'
import { mapRouteError } from '@/lib/route-auth'
import {
  requirePortalSession,
  resolvePortalTenants,
  setPortalContextCookie,
} from '@/lib/portal-guard'

/**
 * POST /api/portal/switch-tenant — bind the chosen tenancy into the signed
 * context cookie (plan-slice-7 §2). The id is re-verified against this
 * user's ACTIVE portal tenants first: a forged id → 403, never scoped.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await requirePortalSession(request)
    const body = await request.json().catch(() => ({}))
    const tenantId = typeof body?.tenantId === 'string' ? body.tenantId : ''
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 })
    }

    const tenants = await resolvePortalTenants(ctx.userId)
    if (!tenants.some((t) => t.id === tenantId)) {
      return NextResponse.json({ success: false, error: 'No portal access' }, { status: 403 })
    }

    const response = ok({ tenantId })
    setPortalContextCookie(response, tenantId)
    return response
  } catch (error) {
    return mapRouteError(error)
  }
}
