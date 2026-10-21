import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/**
 * GET /api/leases/[id] — detail. Tenant PII on parties is upgraded only
 * when the caller ALSO holds `tenant.read` (plan-slice-2 §2.3).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'lease.read',
  async handler({ actor, ctx, params }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const row = await lease.getLease(actor, params.id, {
      includeTenantPii: granted.includes('tenant.read' as never),
    });
    return { lease: row };
  },
});

/** PATCH /api/leases/[id] — draft/active amendment (units re-check overlap). */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'lease.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await lease.updateLease(actor, params.id, input);
    return ok({ lease: row });
  },
});
