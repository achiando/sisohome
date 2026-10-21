import { apiRoute, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/** PATCH /api/unit-types/[id] — flat org scope. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'unit.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const unitType = await units.updateUnitType(actor, params.id, input);
    return { unitType };
  },
});

/** DELETE /api/unit-types/[id] — template rows only; no children reference them. */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'unit.delete',
  async handler({ actor, params }) {
    await units.deleteUnitType(actor, params.id);
    return { success: true };
  },
});
