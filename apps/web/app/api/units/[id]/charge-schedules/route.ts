import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as charges from '@/lib/domain/charge-schedule';

/**
 * GET /api/units/[id]/charge-schedules — recurring bills attached to this
 * unit (rent is lease-driven; RENT rows are rejected on create).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'charge.list',
  async handler({ actor, params }) {
    const schedules = await charges.listUnitSchedules(actor, params.id);
    return { schedules };
  },
});

/** POST /api/units/[id]/charge-schedules — unit-scoped (XOR: unitId only). */
export const POST = apiRoute<{ id: string }>({
  permissions: 'charge.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const schedule = await charges.createUnitSchedule(actor, params.id, input);
    return ok({ schedule }, { status: 201 });
  },
});
