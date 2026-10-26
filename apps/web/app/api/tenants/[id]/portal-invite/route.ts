import { apiRoute, ok } from '@/lib/api-route';
import * as tenant from '@/lib/domain/tenant';

/**
 * POST   /api/tenants/[id]/portal-invite — issue a one-shot portal invite.
 *        Creates a hashed-token TenantPortalInvite (7-day expiry), flips
 *        portalStatus=INVITED, and emails the accept link. The raw link is
 *        also returned ONCE (shown in the dialog). Re-invite allowed while
 *        not ACTIVE (prior outstanding invites are invalidated).
 * DELETE /api/tenants/[id]/portal-invite — revoke an outstanding invite:
 *        outstanding tokens die, portalStatus returns to NOT_INVITED.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'tenant.manage',
  async handler({ actor, params, body }) {
    const raw = await body();
    const invite = await tenant.inviteTenantToPortal(actor, params.id, raw);
    return ok(invite, { status: 201 });
  },
});

export const DELETE = apiRoute<{ id: string }>({
  permissions: 'tenant.manage',
  async handler({ actor, params }) {
    return ok(await tenant.revokeTenantInvite(actor, params.id));
  },
});
