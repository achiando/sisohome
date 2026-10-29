import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * POST /api/offers/[id]/approve — `{ to: ACCEPTED | REJECTED }`. ACCEPTED is
 * transactional: one live accepted offer per listing (409 on a second), the
 * listing flips to UNDER_OFFER, and a PropertyDeal opens automatically with
 * a category-aware checklist.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'offer.approve',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const offer = await offers.approveOffer(actor, params.id, input);
    return ok({ offer });
  },
});
