import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * GET /api/agreements — rows where the caller matches EITHER side
 * (portfolio org OR managing org). Filters: propertyId, status.
 */
export const GET = apiRoute({
  permissions: 'agreement.list',
  async handler({ actor, query }) {
    const list = await agreements.listAgreements(actor, {
      propertyId: query.get('propertyId') ?? undefined,
      status: query.get('status') ?? undefined,
    });
    return { agreements: list };
  },
});

/**
 * POST /api/agreements — dual entry (plan §2.2): the portfolio org picks a
 * manager; any other org may only propose for ITSELF (DRAFT lands in the
 * portfolio org's inbox). Always created as DRAFT.
 */
export const POST = apiRoute({
  permissions: 'agreement.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const agreement = await agreements.createAgreement(actor, input);
    return ok({ agreement }, { status: 201 });
  },
});
