import { apiRoute } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * GET /api/offers/[id] — detail incl. the counter chain (supersedes +
 * counters) and the linked deal.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'offer.read',
  async handler({ actor, params }) {
    const offer = await offers.getOffer(actor, params.id);
    return { offer };
  },
});
