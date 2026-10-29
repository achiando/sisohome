import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * POST /api/listings/[id]/close — terminal transitions
 * (SOLD/RENTED/WITHDRAWN/EXPIRED) per the close map. Portfolio side only;
 * SOLD/WITHDRAWN append price-history rows.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'listing.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const listing = await sales.closeListing(actor, params.id, input);
    return ok({ listing });
  },
});
