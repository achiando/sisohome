import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/viewings/[id] — one scheduled viewing (same scope as the list).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'viewing.read',
  async handler({ actor, params }) {
    const viewing = await sales.getViewing(actor, params.id);
    return { viewing };
  },
});

/**
 * PATCH /api/viewings/[id] — reschedule, outcome
 * (SCHEDULED→COMPLETED/NO_SHOW/CANCELLED) and feedback capture. A COMPLETED
 * viewing with INTERESTED feedback gives the linked own-org lead a
 * best-effort OFFERING bump.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'viewing.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const viewing = await sales.updateViewing(actor, params.id, input);
    return ok({ viewing });
  },
});
