import { apiRoute } from '@/lib/api-route';
import * as rentRoll from '@/lib/domain/rent-roll';

/**
 * GET /api/properties/[id]/rent-roll — per-unit occupancy + lease rent +
 * open/overdue balances, building subtotals and grand totals. Out-of-scope
 * property → 404 (via requirePropertyInScope).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'charge.list',
  async handler({ actor, params }) {
    const { property, totals, buildings, rows } = await rentRoll.rentRoll(actor, params.id);
    return { property, totals, buildings, rows };
  },
});
