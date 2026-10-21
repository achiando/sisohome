import { apiRoute, ok } from '@/lib/api-route';
import * as tenant from '@/lib/domain/tenant';

/**
 * POST /api/tenants/[id]/portal-invite — issue a one-shot portal invite.
 * Creates a hashed-token TenantPortalInvite (7-day expiry), flips
 * portalStatus=INVITED. The raw link is returned ONCE (shown in the dialog);
 * acceptance flow is slice 7. Re-invite allowed while not ACTIVE (prior
 * outstanding invites are invalidated).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'tenant.manage',
  async handler({ actor, params, body }) {
    const raw = await body();
    const invite = await tenant.inviteTenantToPortal(actor, params.id, raw);
    return ok(invite, { status: 201 });
  },
});
