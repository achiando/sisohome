import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/viewings — scheduler list. Reachable rows: parent property in
 * scope, rows owned by this org, or rows where this user is the booking
 * agent (MK agents keep access to viewings they created on shared
 * properties). Filters: propertyId, status, from, to.
 */
export const GET = apiRoute({
  permissions: 'viewing.list',
  async handler({ actor, query }) {
    const list = await sales.listViewings(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      status: query.get('status') ?? undefined,
      from: query.get('from') ?? undefined,
      to: query.get('to') ?? undefined,
    });
    return { viewings: list };
  },
});

/**
 * POST /api/viewings — book a viewing. The property must be in scope OR
 * readable through a listing on either side; the row is owned by the
 * property's portfolio org and the booking user becomes the agent. Linked
 * leads (own-org) get a best-effort VIEWING bump.
 */
export const POST = apiRoute({
  permissions: 'viewing.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const viewing = await sales.createViewing(actor, input);
    return ok({ viewing }, { status: 201 });
  },
});
