import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as offers from '@/lib/domain/offer';

/**
 * GET /api/deals/[id] — deal room: checklist, sale price, commission,
 * buyer party, linked offer/listing.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'offer.read',
  async handler({ actor, params }) {
    const deal = await offers.getDeal(actor, params.id);
    return { deal };
  },
});

/**
 * PATCH /api/deals/[id] — checklist item toggles `{key, done}`, commission
 * amount, notes, soft progression (AGREED→DUE_DILIGENCE→COMPLETION_PENDING,
 * collapse), and the buyer party (must live in the deal's organization).
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'offer.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const deal = await offers.patchDeal(actor, params.id, input);
    return ok({ deal });
  },
});
