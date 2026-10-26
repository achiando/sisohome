import { apiRoutePortal } from '@/lib/portal-guard'
import { getPortalLeases } from '@/lib/domain/portal'

/** GET /api/portal/lease — active + historical leases for the tenant. */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return { leases: await getPortalLeases(actor) }
  },
})
