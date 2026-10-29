import { apiRoute } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/listings/[id]/price-history — the LISTED/REDUCED/INCREASED/
 * WITHDRAWN/SOLD audit trail. Readable from either side (the shared side
 * already sees the price itself in its projection).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'listing.read',
  async handler({ actor, params }) {
    const history = await sales.listPriceHistory(actor, params.id);
    return { history };
  },
});
