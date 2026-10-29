import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/leads — capture-org inbox. Rows captured by this org, plus leads
 * handed TO this org (ACCEPTED handoff relationship — never re-pointed).
 * Filters: status, source, assignedTo (id or `me`), q, needsAction=1.
 */
export const GET = apiRoute({
  permissions: 'lead.list',
  async handler({ actor, query }) {
    const list = await sales.listLeads(actor, {
      status: query.get('status') ?? undefined,
      source: query.get('source') ?? undefined,
      assignedTo: query.get('assignedTo') ?? undefined,
      q: query.get('q') ?? undefined,
      needsAction: query.get('needsAction') ?? undefined,
    });
    return { leads: list };
  },
});

/**
 * POST /api/leads — capture a house hunter/buyer. The row is owned by the
 * CALLER's org forever; interest refs (propertyId/listingId) must be
 * reachable from this org (scope, or a listing on either side).
 */
export const POST = apiRoute({
  permissions: 'lead.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const lead = await sales.createLead(actor, input);
    return ok({ lead }, { status: 201 });
  },
});
