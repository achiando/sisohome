import { apiRoute, ok } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * POST /api/listings/[id]/publish — DRAFT/PAUSED → PUBLISHED. Requires the
 * property to have a map pin (latitude/longitude) and a price (or
 * price-on-request). Held by MK marketing_agent too, so a shared listing's
 * agent can put it live once the portfolio side has set the price block.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'listing.publish',
  async handler({ actor, params }) {
    const listing = await sales.publishListing(actor, params.id);
    return ok({ listing });
  },
});
