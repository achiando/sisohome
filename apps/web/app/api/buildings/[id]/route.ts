import { apiRoute, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/** PATCH /api/buildings/[id] — parent-scoped; 409 on duplicate code per property. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'unit.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const building = await units.updateBuilding(actor, params.id, input);
    return { building };
  },
});

/** DELETE /api/buildings/[id] — blocked (409) while units are attached. */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'unit.delete',
  async handler({ actor, params }) {
    await units.deleteBuilding(actor, params.id);
    return { success: true };
  },
});
