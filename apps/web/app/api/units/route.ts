import { authorizationService } from '@/lib/auth';
import { apiRoute } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/**
 * GET /api/units — global units register (portfolio-wide, /units).
 * Property-scoped via the parent (4 arms). Tenant contact fields are included
 * only when the caller ALSO holds `tenant.read` (PII mask, plan-slice-3 §3).
 * Filters: propertyId, status, buildingId ('none' = unassigned), q.
 */
export const GET = apiRoute({
  permissions: 'unit.list',
  async handler({ actor, ctx, query }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const list = await units.listAllUnits(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      status: query.get('status') ?? undefined,
      buildingId: query.get('buildingId') ?? undefined,
      q: query.get('q') ?? undefined,
      includeTenantContact: granted.includes('tenant.read' as never),
    });
    return { units: list };
  },
});
