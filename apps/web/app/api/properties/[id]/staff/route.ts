import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * GET /api/properties/[id]/staff — assignments (incl. revoked history) for
 * a scoped property. Permission `property.read` (anyone who may view the
 * property sees its team).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'property.read',
  async handler({ actor, params }) {
    const assignments = await agreements.listStaff(actor, params.id);
    return { assignments };
  },
});

/**
 * POST /api/properties/[id]/staff — assign a user (scope arm 3 from
 * `startsAt`). Permission `property.update` (plan §3.3 — the relationship.*
 * family is not held by any role template). Duplicate active → 409.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'property.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const assignment = await agreements.createStaff(actor, params.id, input);
    return ok({ assignment }, { status: 201 });
  },
});
