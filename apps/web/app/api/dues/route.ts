import { apiRoute } from '@/lib/api-route';
import * as dues from '@/lib/domain/dues';

/**
 * GET /api/dues — tenant dues/arrears register: KPI totals + one row per
 * tenant × property with open balance and aging bucket. Filters:
 * propertyId, unitId, tenantId, overdueOnly=true.
 */
export const GET = apiRoute({
  permissions: 'charge.list',
  async handler({ actor, query }) {
    const result = await dues.tenantDues(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      tenantId: query.get('tenantId') ?? undefined,
      overdueOnly: query.get('overdueOnly') === 'true',
    });
    return { totals: result.totals, rows: result.rows };
  },
});
