import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/listings/[id] — detail. Owner side receives the full property
 * row; the shared (marketing) side receives a projection only (title block,
 * price, pin, address summary — no internal property state).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'listing.read',
  async handler({ actor, params }) {
    const listing = await sales.getListing(actor, params.id);
    return { listing };
  },
});

/**
 * PATCH /api/listings/[id] — content/price/terms edit with a per-side field
 * allowlist: the marketing (shared) side may only touch
 * title/description/highlights/contact*; price fields, sharing and purpose
 * are portfolio-side only. Asking-price changes always write a price-history
 * row in the same transaction.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'listing.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const listing = await sales.updateListing(actor, params.id, input);
    return ok({ listing });
  },
});
