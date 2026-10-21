import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';

/**
 * GET /api/properties/[id]/ownerships — property-level AND unit-level rows
 * (unit rows resolve through `unit.property`), scope through the parent.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'ownership.read',
  async handler({ actor, params }) {
    const rows = await ownership.listPropertyOwnerships(actor, params.id);
    return { ownerships: rows };
  },
});

/**
 * POST /api/properties/[id]/ownerships — property-level rows only
 * (XOR: unit-level lives at POST /api/units/[id]/ownership).
 * Portfolio side only; party must sit in the portfolio-org directory;
 * active sharePercent sum ≤ 100 (400).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'ownership.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    if (input.unitId !== undefined && input.unitId !== null && input.unitId !== '') {
      throw new RouteError(400, 'Use POST /api/units/[id]/ownership for unit-level ownership');
    }
    const row = await ownership.createOwnership(actor, { propertyId: params.id }, input);
    return ok({ ownership: row }, { status: 201 });
  },
});
