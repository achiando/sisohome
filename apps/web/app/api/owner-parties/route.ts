import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as ownership from '@/lib/domain/ownership';

/**
 * GET /api/owner-parties — flat org directory (+ optional search).
 * `?propertyId=` switches to that property's portfolio-org directory when
 * the caller can scope the property (manager picker on agreement create).
 */
export const GET = apiRoute({
  permissions: 'ownership.read',
  async handler({ actor, query }) {
    const parties = await ownership.listOwnerParties(actor, {
      q: query.get('q') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
    });
    return { parties };
  },
});

/** POST /api/owner-parties — new directory row in the caller's org. */
export const POST = apiRoute({
  permissions: 'ownership.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const party = await ownership.createOwnerParty(actor, input);
    return ok({ party }, { status: 201 });
  },
});
