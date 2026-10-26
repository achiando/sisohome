import { apiRoutePortal } from '@/lib/portal-guard';
import { createPaymentClaim, listTenantPaymentClaims } from '@/lib/domain/payment-claim';

/**
 * GET /api/portal/payment-claims — the tenant's own claims (newest first).
 * POST — post a payment message; unit must sit on their active lease.
 * Relationship-scoped by the portal guard (no permission keys by design).
 */
export const GET = apiRoutePortal({
  async handler({ actor }) {
    return await listTenantPaymentClaims(actor);
  },
});

export const POST = apiRoutePortal({
  async handler({ actor, body }) {
    const input = await body();
    return await createPaymentClaim(actor, input);
  },
});
