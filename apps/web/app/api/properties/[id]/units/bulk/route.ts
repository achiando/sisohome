import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/**
 * POST /api/properties/[id]/units/bulk — range generator ("units 101–124").
 * Body: { prefix?, from, to, skip?, buildingId?, unitTypeTemplateId?,
 * defaults }. All-or-nothing: every generated ref is pre-validated for
 * uniqueness; a single conflict 409s with the exact conflicting refs.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'unit.create',
  async handler({ actor, params, body }) {
    const input = await body<units.BulkUnitInput>();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const result = await units.bulkCreateUnits(actor, params.id, input ?? ({} as units.BulkUnitInput));
    return ok(result, { status: 201 });
  },
});
