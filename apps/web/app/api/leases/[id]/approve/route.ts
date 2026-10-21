import { apiRoute, ok } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/**
 * POST /api/leases/[id]/approve — PENDING_APPROVAL → SCHEDULED/ACTIVE
 * (startsAt ≤ today). Optional `{ signedAt }`. Recomputes unit occupancy.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lease.approve',
  async handler({ actor, params, body }) {
    const input = await body();
    const row = await lease.approveLease(actor, params.id, input);
    return ok({ lease: row });
  },
});
