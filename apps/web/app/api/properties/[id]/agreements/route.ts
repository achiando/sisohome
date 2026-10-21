import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * POST /api/properties/[id]/agreements — owner-side create path: the actor
 * must already reach the property (scope), then the row is filed in the
 * property's portfolio org as DRAFT.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'agreement.create',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const agreement = await agreements.createAgreement(
      actor,
      { ...input, propertyId: params.id },
      { requirePropertyScope: true },
    );
    return ok({ agreement }, { status: 201 });
  },
});
