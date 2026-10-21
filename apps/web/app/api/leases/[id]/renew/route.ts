import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/**
 * POST /api/leases/[id]/renew — creates a NEW lease (`renewalOfId`) with
 * copied units/parties + new dates; old lease → ENDING (default) or
 * TERMINATED per `{ oldStatus }`. Body: `{ startsAt, endsAt?, status?, oldStatus? }`.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lease.manage',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await lease.renewLease(actor, params.id, input);
    return ok({ lease: row }, { status: 201 });
  },
});
