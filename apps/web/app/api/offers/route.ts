import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * GET /api/offers — offer register (portfolio side; property-scoped).
 * Filters: listingId, status.
 */
export const GET = apiRoute({
  permissions: 'offer.list',
  async handler({ actor, query }) {
    const list = await offers.listOffers(actor, {
      listingId: query.get('listingId') ?? undefined,
      status: query.get('status') ?? undefined,
    });
    return { offers: list };
  },
});

/**
 * POST /api/offers — submit an offer on a PUBLISHED/UNDER_OFFER listing in
 * scope. Starts SUBMITTED; the currency is taken from the listing.
 */
export const POST = apiRoute({
  permissions: 'offer.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const offer = await offers.createOffer(actor, input);
    return ok({ offer }, { status: 201 });
  },
});
