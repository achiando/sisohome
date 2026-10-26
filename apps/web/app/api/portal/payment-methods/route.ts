import { apiRoutePortal } from '@/lib/portal-guard'
import { getPortalPaymentInstructions } from '@/lib/domain/portal'

/** GET /api/portal/payment-methods — static pay-instructions (no payments). */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return await getPortalPaymentInstructions(actor)
  },
})
