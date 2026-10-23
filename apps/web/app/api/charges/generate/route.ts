import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as monthly from '@/lib/domain/monthly';

/**
 * POST /api/charges/generate — generate one month of charges (rent from
 * active leases + utility bills from unit schedules). Idempotent per period.
 */
export const POST = apiRoute({
  permissions: 'charge.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const propertyId = typeof input.propertyId === 'string' ? input.propertyId.trim() : '';
    if (!propertyId) throw new RouteError(400, 'propertyId is required');
    const month = typeof input.month === 'string' ? input.month.trim() : '';
    if (!month) throw new RouteError(400, 'month is required (YYYY-MM)');
    const result = await monthly.generateMonthlyCharges(actor, { propertyId, month });
    return ok({ result });
  },
});
