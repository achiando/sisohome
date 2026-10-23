import { apiRoute } from '@/lib/api-route';
import * as monthly from '@/lib/domain/monthly';

/**
 * GET /api/ledger/monthly — month-by-month billed vs paid matrix, rent and
 * utilities split. Query: propertyId | tenantId | unitId (at least one),
 * from=YYYY-MM, to=YYYY-MM. Powers the tenant rent-by-month view, the
 * unit pending/paid view, and the property manager report.
 */
export const GET = apiRoute({
  permissions: 'charge.list',
  async handler({ actor, query }) {
    const rows = await monthly.monthlyLedger(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      tenantId: query.get('tenantId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      from: query.get('from') ?? '',
      to: query.get('to') ?? '',
    });
    return { months: rows };
  },
});
