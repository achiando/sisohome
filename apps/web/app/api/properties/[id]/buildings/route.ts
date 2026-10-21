import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/** GET /api/properties/[id]/buildings — buildings under a scoped property. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'unit.list',
  async handler({ actor, params }) {
    const buildings = await units.listBuildings(actor, params.id);
    return { buildings };
  },
});

/** POST /api/properties/[id]/buildings — org = property's portfolio org; code unique per property. */
export const POST = apiRoute<{ id: string }>({
  permissions: 'unit.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const building = await units.createBuilding(actor, params.id, input);
    return ok({ building }, { status: 201 });
  },
});
