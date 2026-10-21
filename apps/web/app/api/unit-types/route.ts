import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/** GET /api/unit-types — flat org catalog (template rows, not property rows). */
export const GET = apiRoute({
  permissions: 'unit.read',
  async handler({ actor }) {
    const unitTypes = await units.listUnitTypes(actor);
    return { unitTypes };
  },
});

/** POST /api/unit-types — unique (org, name). */
export const POST = apiRoute({
  permissions: 'unit.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const unitType = await units.createUnitType(actor, input);
    return ok({ unitType }, { status: 201 });
  },
});
