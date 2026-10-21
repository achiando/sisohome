import { apiRoute, RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';

/** GET /api/owner-parties/[id] — party + its ownerships (own org only). */
export const GET = apiRoute<{ id: string }>({
  permissions: 'ownership.read',
  async handler({ actor, params }) {
    const party = await ownership.getOwnerParty(actor, params.id);
    return { party };
  },
});

/** PATCH /api/owner-parties/[id] — flat org updateMany. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'ownership.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const party = await ownership.updateOwnerParty(actor, params.id, input);
    return { party };
  },
});

/** DELETE /api/owner-parties/[id] — blocked (409) while referenced. */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'ownership.update',
  async handler({ actor, params }) {
    await ownership.deleteOwnerParty(actor, params.id);
    return { success: true };
  },
});
