import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/** GET /api/maintenance/inspections/[id] — detail (findings, inspector). */
export const GET = apiRoute<{ id: string }>({
  permissions: 'inspection.read',
  async handler({ actor, params }) {
    const row = await maintenance.getInspection(actor, params.id);
    return { inspection: row };
  },
});

/** PATCH /api/maintenance/inspections/[id] — pre-completion edits. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'inspection.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.updateInspection(actor, params.id, input);
    return ok({ inspection: row });
  },
});
