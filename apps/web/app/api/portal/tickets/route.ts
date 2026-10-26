import { ok } from '@/lib/api-route'
import { apiRoutePortal } from '@/lib/portal-guard'
import { createPortalTicket, getPortalTickets } from '@/lib/domain/portal'

/**
 * GET  /api/portal/tickets — tickets this tenant reported (+ note thread).
 * POST /api/portal/tickets — create for one of their own units.
 */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return { tickets: await getPortalTickets(actor) }
  },
})

export const POST = apiRoutePortal({
  async handler({ actor, body }) {
    const ticket = await createPortalTicket(actor, await body())
    return ok({ ticket }, { status: 201 })
  },
})
