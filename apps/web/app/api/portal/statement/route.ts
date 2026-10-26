import { apiRoutePortal } from '@/lib/portal-guard'
import { getPortalStatement } from '@/lib/domain/portal'

/** GET /api/portal/statement — charges, payments and derived balance. */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return await getPortalStatement(actor)
  },
})
