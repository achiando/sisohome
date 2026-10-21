import { apiRoute, RouteError } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/** GET /api/agreements/[id] — either-side; response carries `actorIsPortfolioSide`. */
export const GET = apiRoute<{ id: string }>({
  permissions: 'agreement.read',
  async handler({ actor, params }) {
    const agreement = await agreements.getAgreement(actor, params.id);
    return { agreement };
  },
});

/**
 * PATCH /api/agreements/[id] — dates/scope only. DRAFT: either side;
 * ACTIVE/SUSPENDED: portfolio side only; closed rows → 409.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'agreement.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const agreement = await agreements.updateAgreement(actor, params.id, input);
    return { agreement };
  },
});
