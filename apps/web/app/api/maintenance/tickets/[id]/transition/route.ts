import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/**
 * POST /api/maintenance/tickets/[id]/transition — `{ to }` against
 * TICKET_TRANSITIONS; illegal move → 409 (plan §2).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'maintenance.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.transitionTicket(actor, params.id, input);
    return ok({ ticket: row });
  },
});
