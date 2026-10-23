import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as leases from '@/lib/domain/lease';

/**
 * POST /api/leases/quick — one-dialog tenancy from a vacant unit row.
 * Body: { propertyId, unitId, monthlyRent?, startsAt, endsAt?, tenantId |
 * newTenant: { displayName, phone?, email?, partyType? }, depositMonths? }.
 * Creates the tenant when one isn't picked, then drafts a PENDING_APPROVAL
 * lease. Gated lease.create; unit/property scope-checked server-side.
 */
export const POST = apiRoute({
  permissions: 'lease.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const { lease, tenantId } = await leases.createQuickTenancy(actor, input);
    return ok({ lease, tenantId }, { status: 201 });
  },
});
