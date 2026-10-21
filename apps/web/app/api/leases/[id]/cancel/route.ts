import { apiRoute, ok } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/** POST /api/leases/[id]/cancel — DRAFT/PENDING → CANCELLED. */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lease.update',
  async handler({ actor, params }) {
    const row = await lease.cancelLease(actor, params.id);
    return ok({ lease: row });
  },
});
