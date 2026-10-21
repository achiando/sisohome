import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as tenant from '@/lib/domain/tenant';

/** GET /api/tenants/[id] — full profile (leases, applications, portal state). */
export const GET = apiRoute<{ id: string }>({
  permissions: 'tenant.read',
  async handler({ actor, params }) {
    const row = await tenant.getTenant(actor, params.id);
    return { tenant: row };
  },
});

/** PATCH /api/tenants/[id] — edit within OR-scope, keyed by the row's own org. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'tenant.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await tenant.updateTenant(actor, params.id, input);
    return ok({ tenant: row });
  },
});

/** DELETE /api/tenants/[id] — only while unlinked (409 once leased/applied). */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'tenant.delete',
  async handler({ actor, params }) {
    await tenant.removeTenant(actor, params.id);
  },
});
