import { apiRoute, ok } from '@/lib/api-route';
import * as adjustments from '@/lib/domain/adjustment';

/** POST /api/adjustments/[id]/approve — PENDING → APPROVED (409 otherwise). */
export const POST = apiRoute<{ id: string }>({
  permissions: 'adjustment.approve',
  async handler({ actor, params }) {
    const adjustment = await adjustments.decideAdjustment(actor, params.id, 'APPROVED');
    return ok({ adjustment });
  },
});
