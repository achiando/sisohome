import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/**
 * POST /api/properties/[id]/units/import — spreadsheet import (CSV/Excel),
 * PARTIAL success: each row is created independently and failures come back
 * as `{ rowIndex → reason }` so the upload dialog can show exactly which
 * rows to fix. Same validation path as single-unit create (unique ref per
 * property, kind required, amenities stripped vs the property's own list).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'unit.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const result = await units.importUnits(actor, params.id, (input as { rows?: unknown }).rows);
    return ok(result, { status: 201 });
  },
});
