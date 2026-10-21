import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/** GET /api/maintenance/schedules — recurring jobs (next due first). */
export const GET = apiRoute({
  permissions: 'schedule.list',
  async handler({ actor, query }) {
    const schedules = await maintenance.listSchedules(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      active: query.get('active') ?? undefined,
    });
    return { schedules };
  },
});

/** POST /api/maintenance/schedules — nextDueAt computed from frequency. */
export const POST = apiRoute({
  permissions: 'schedule.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.createSchedule(actor, input);
    return ok({ schedule: row }, { status: 201 });
  },
});
