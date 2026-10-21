import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/**
 * GET /api/properties/[id]/units — units under a scoped property with
 * LEASE-DERIVED occupancy (status cache never overrides an active lease).
 * Tenant contact fields only with `tenant.read` (PII mask).
 * Filters: status, buildingId ('none' = unassigned), q.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'unit.list',
  async handler({ actor, ctx, params, query }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const list = await units.listUnits(actor, params.id, {
      status: query.get('status') ?? undefined,
      buildingId: query.get('buildingId') ?? undefined,
      q: query.get('q') ?? undefined,
      includeTenantContact: granted.includes('tenant.read' as never),
    });
    return { units: list };
  },
});

/** POST /api/properties/[id]/units — org = portfolio org; unitRef unique per property (409). */
export const POST = apiRoute<{ id: string }>({
  permissions: 'unit.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const unit = await units.createUnit(actor, params.id, input);
    return ok({ unit }, { status: 201 });
  },
});
