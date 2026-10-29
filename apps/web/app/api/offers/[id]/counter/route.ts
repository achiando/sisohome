import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * POST /api/offers/[id]/counter — counters are NEW rows: the previous offer
 * moves to COUNTERED and the new SUBMITTED row points at it via
 * `supersedesOfferId` (one transaction — offers are never overwritten).
 * Body: `{ amount, terms? }`.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'offer.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const offer = await offers.counterOffer(actor, params.id, input);
    return ok({ offer }, { status: 201 });
  },
});
