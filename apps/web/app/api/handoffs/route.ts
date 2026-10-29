import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as handoffs from '@/lib/domain/handoff';

/**
 * GET /api/handoffs — either-direction list (outgoing by me, incoming to
 * me). `?direction=outgoing|incoming`, `?status=`, and `?orgQuery=` for the
 * handoff dialog's free target-org search (id/name/kind of other active
 * orgs — the UI previews the name before sending).
 */
export const GET = apiRoute({
  permissions: 'lead.list',
  async handler({ actor, query }) {
    const orgQuery = query.get('orgQuery');
    if (orgQuery) {
      const orgs = await handoffs.searchHandoffTargets(actor, orgQuery);
      return { orgs };
    }
    const list = await handoffs.listHandoffs(actor, {
      direction: query.get('direction') ?? undefined,
      status: query.get('status') ?? undefined,
    });
    return { handoffs: list };
  },
});

/**
 * POST /api/handoffs — offer an own-org lead to another organization.
 * `{ leadId, toOrganizationId, listingId?, message? }`. The lead row is
 * never re-pointed; ACCEPTED is what grants the receiver read access.
 */
export const POST = apiRoute({
  permissions: 'handoff.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const handoff = await handoffs.createHandoff(actor, input);
    return ok({ handoff }, { status: 201 });
  },
});
