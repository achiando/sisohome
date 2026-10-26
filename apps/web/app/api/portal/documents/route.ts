import { apiRoutePortal } from '@/lib/portal-guard'
import { getPortalDocuments } from '@/lib/domain/portal'

/** GET /api/portal/documents — documents on this tenant/their leases only. */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return { documents: await getPortalDocuments(actor) }
  },
})
