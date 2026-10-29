import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as sales from '@/lib/domain/sales';

/**
 * GET /api/leads/[id] — profile with viewings/offers/handoffs. The receiver
 * org of an ACCEPTED handoff can read (rows matched through the handoff
 * relationship, flagged `viaHandoffFrom`).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'lead.read',
  async handler({ actor, params }) {
    const lead = await sales.getLead(actor, params.id);
    return { lead };
  },
});

/**
 * PATCH /api/leads/[id] — edit the capturing org's row only. `status` is
 * not editable here (use /status — transition map applies).
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'lead.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const lead = await sales.updateLead(actor, params.id, input);
    return ok({ lead });
  },
});
