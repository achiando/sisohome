import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/** GET /api/maintenance/inspections — register grouped by date in the UI. */
export const GET = apiRoute({
  permissions: 'inspection.list',
  async handler({ actor, query }) {
    const inspections = await maintenance.listInspections(actor, {
      status: query.get('status') ?? undefined,
      kind: query.get('kind') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
    });
    return { inspections };
  },
});

/** POST /api/maintenance/inspections — schedule one (inspector = member). */
export const POST = apiRoute({
  permissions: 'inspection.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.createInspection(actor, input);
    return ok({ inspection: row }, { status: 201 });
  },
});
