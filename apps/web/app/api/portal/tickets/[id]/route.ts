import { apiRoutePortal } from '@/lib/portal-guard'
import { appendPortalTicketNote, getPortalTicket } from '@/lib/domain/portal'

/**
 * GET   /api/portal/tickets/[id] — own ticket + thread (cross-tenant → 404).
 * PATCH /api/portal/tickets/[id] — append a note ONLY; any other field
 *       (status, priority, …) is rejected — lifecycle stays org-controlled.
 */
export const GET = apiRoutePortal<{ id: string }>({
  async handler({ actor, params }) {
    return { ticket: await getPortalTicket(actor, params.id) }
  },
})

export const PATCH = apiRoutePortal<{ id: string }>({
  async handler({ actor, params, body }) {
    const note = await appendPortalTicketNote(actor, params.id, await body())
    return { note }
  },
})
