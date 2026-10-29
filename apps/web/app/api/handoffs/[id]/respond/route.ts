import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as handoffs from '@/lib/domain/handoff';

/**
 * POST /api/handoffs/[id]/respond — receiver org only
 * (`lead.update` in the receiver). `{ to: ACCEPTED | DECLINED }` —
 * ACCEPTED opens the lead through the relationship (row stays with the
 * capturing org).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lead.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const handoff = await handoffs.respondHandoff(actor, params.id, input);
    return ok({ handoff });
  },
});
