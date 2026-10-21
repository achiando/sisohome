import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as tenant from '@/lib/domain/tenant';

/** GET /api/tenants — tenant directory (OR-scope: own-captured or lease-linked). */
export const GET = apiRoute({
  permissions: 'tenant.list',
  async handler({ actor, query }) {
    const tenants = await tenant.listTenants(actor, {
      status: query.get('status') ?? undefined,
      q: query.get('q') ?? undefined,
    });
    return { tenants };
  },
});

/** POST /api/tenants — capture a tenant party in the caller's org. */
export const POST = apiRoute({
  permissions: 'tenant.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await tenant.createTenant(actor, input);
    return ok({ tenant: row }, { status: 201 });
  },
});
