import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * POST /api/deals/[id]/complete — the ownership flip, gated on
 * `ownership.update` (it writes PropertyOwnership): closes open seller
 * rows, opens the buyer row, deal → COMPLETED, listing → SOLD/RENTED (+
 * SOLD price history). Body may pass `buyerOwnerPartyId`; otherwise the
 * party previously PATCHed onto the deal is used.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'ownership.update',
  async handler({ actor, params, body }) {
    const input = (await body()) ?? {};
    if (typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const deal = await offers.completeDeal(actor, params.id, input);
    return ok({ deal });
  },
});
