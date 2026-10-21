import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';

/**
 * POST /api/units/[id]/ownership — unit-level row (XOR: propertyId null,
 * unitId set). Resolves the unit's property for scope + portfolio checks.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'ownership.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    if (input.propertyId !== undefined && input.propertyId !== null && input.propertyId !== '') {
      throw new RouteError(400, 'propertyId is derived from the unit — remove it from the payload');
    }
    const row = await ownership.createOwnership(actor, { unitId: params.id }, input);
    return ok({ ownership: row }, { status: 201 });
  },
});
