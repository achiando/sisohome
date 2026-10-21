import { apiRoute, RouteError } from '@/lib/api-route';
import * as units from '@/lib/domain/unit';

/** GET /api/units/[id] — parent-scoped unit + derived occupancy. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'unit.read',
  async handler({ actor, params }) {
    const unit = await units.getUnit(actor, params.id);
    return { unit };
  },
});

/**
 * PATCH /api/units/[id] — parent-scoped. Status restricted to
 * vacant/maintenance/blocked — OCCUPIED/RESERVED follow leases (slice 2).
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'unit.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const unit = await units.updateUnit(actor, params.id, input);
    return { unit };
  },
});

/** DELETE /api/units/[id] — blocked (409) while leases/charges reference it. */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'unit.delete',
  async handler({ actor, params }) {
    await units.deleteUnit(actor, params.id);
    return { success: true };
  },
});
