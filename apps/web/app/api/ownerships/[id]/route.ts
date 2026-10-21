import { apiRoute, RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';

/** PATCH /api/ownerships/[id] — window/share edits; portfolio side only. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'ownership.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await ownership.updateOwnership(actor, params.id, input);
    return { ownership: row };
  },
});

/** DELETE /api/ownerships/[id] — hard delete (audit keeps history, plan §3.3). */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'ownership.update',
  async handler({ actor, params }) {
    await ownership.deleteOwnership(actor, params.id);
    return { success: true };
  },
});
