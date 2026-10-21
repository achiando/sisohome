import { apiRoute, ok } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';

/**
 * POST /api/leases/[id]/terminate — → TERMINATED; optional
 * `{ noticeDate, endsToday }` (default: ends today). Recomputes occupancy.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'lease.manage',
  async handler({ actor, params, body }) {
    const input = await body();
    const row = await lease.terminateLease(actor, params.id, input);
    return ok({ lease: row });
  },
});
