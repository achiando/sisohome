import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/**
 * POST /api/maintenance/inspections/[id]/complete — `{ to: PASSED|FAILED,
 * findings? }`; FAILED requires findings (plan §3).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'inspection.update',
  async handler({ actor, params, body }) {
    const input = (await body()) ?? {};
    if (typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.completeInspection(actor, params.id, input);
    return ok({ inspection: row });
  },
});
