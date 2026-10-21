import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/** GET /api/maintenance/schedules/[id] — detail. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'schedule.read',
  async handler({ actor, params }) {
    const row = await maintenance.getSchedule(actor, params.id);
    return { schedule: row };
  },
});

/** PATCH /api/maintenance/schedules/[id] — frequency/start recompute next due. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'schedule.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.updateSchedule(actor, params.id, input);
    return ok({ schedule: row });
  },
});

/** DELETE /api/maintenance/schedules/[id] — SOFT (isActive=false, plan §3). */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'schedule.update',
  async handler({ actor, params }) {
    const row = await maintenance.deactivateSchedule(actor, params.id);
    return ok({ schedule: row });
  },
});
