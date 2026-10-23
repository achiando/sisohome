import { apiRoute } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge';

/**
 * GET /api/charges — the charge register (posted + draft) with DERIVED
 * balance per row. Filters: propertyId, unitId, tenantId, leaseId,
 * accountType (RENT | UTILITIES), posted (true|false).
 */
export const GET = apiRoute({
  permissions: 'charge.list',
  async handler({ actor, query }) {
    const postedRaw = query.get('posted');
    const list = await charges.listCharges(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      tenantId: query.get('tenantId') ?? undefined,
      leaseId: query.get('leaseId') ?? undefined,
      accountType: query.get('accountType') ?? undefined,
      posted: postedRaw === 'true' ? true : postedRaw === 'false' ? false : undefined,
    });
    return { charges: list };
  },
});
