import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/**
 * GET /api/leases — lease register (scope + filters). Party contact PII is
 * stripped unless the caller also holds `tenant.read` (plan-slice-2 §2.3).
 */
export const GET = apiRoute({
  permissions: 'lease.list',
  async handler({ actor, ctx, query }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const includeTenantPii = granted.includes('tenant.read' as never);
    const rows = await lease.listLeases(actor, {
      status: query.get('status') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      expiringInDays: query.get('expiringInDays') ?? undefined,
    });
    const leases = includeTenantPii
      ? rows
      : rows.map((l) => ({
          ...l,
          parties: l.parties.map((p) => ({
            ...p,
            tenant: { id: p.tenant.id, displayName: p.tenant.displayName, status: p.tenant.status, portalStatus: p.tenant.portalStatus },
          })),
        }));
    return { leases };
  },
});

/** POST /api/leases — draft or submit a lease (overlap-checked). */
export const POST = apiRoute({
  permissions: 'lease.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await lease.createLease(actor, input);
    return ok({ lease: row }, { status: 201 });
  },
});
