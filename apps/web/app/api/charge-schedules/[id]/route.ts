import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge-schedule';

/**
 * /api/charge-schedules/[id] — unit-scoped recurring bill. Scope resolves
 * through the owning unit's property (404 out of scope).
 */

/** PATCH /api/charge-schedules/[id] — edit name/amount/frequency/dates/active. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'charge.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const schedule = await charges.updateSchedule(actor, params.id, input);
    return ok({ schedule });
  },
});

/** DELETE /api/charge-schedules/[id] — remove the recurring rule. */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'charge.manage',
  async handler({ actor, params }) {
    await charges.removeSchedule(actor, params.id);
  },
});
