import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/listings — the sales board (own + managed-property listings, plus
 * listings shared TO this org by a portfolio owner). Each row carries
 * `access: 'owner' | 'shared'` so the UI can badge Mine / Shared-with-me.
 * Filters: status, purpose, q.
 */
export const GET = apiRoute({
  permissions: 'listing.list',
  async handler({ actor, query }) {
    const list = await sales.listListings(actor, {
      status: query.get('status') ?? undefined,
      purpose: query.get('purpose') ?? undefined,
      q: query.get('q') ?? undefined,
    });
    return { listings: list };
  },
});

/**
 * POST /api/listings — draft a for-sale/for-rent listing. The property must
 * pass `propertyScopeWhere`; the row is owned by the property's PORTFOLIO
 * org (never the caller's org unless they are it). Starts as DRAFT with a
 * LISTED price-history row when an asking price is given.
 */
export const POST = apiRoute({
  permissions: 'listing.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const listing = await sales.createListing(actor, input);
    return ok({ listing }, { status: 201 });
  },
});
