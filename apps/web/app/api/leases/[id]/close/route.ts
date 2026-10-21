import { apiRoute, ok } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/** POST /api/leases/[id]/close — → CLOSED (balance check rides slice 4). */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lease.manage',
  async handler({ actor, params }) {
    const row = await lease.closeLease(actor, params.id);
    return ok({ lease: row });
  },
});
