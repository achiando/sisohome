import { apiRoute, ok } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * POST /api/work-orders/[id]/authorize — PENDING/ON_HOLD → AUTHORIZED.
 * Stamps authorizedAt/by and flips the linked ticket to IN_PROGRESS
 * (plan §2/§3). Either side may authorize if their keys allow.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'work_order.update',
  async handler({ actor, params }) {
    const row = await workOrder.transitionWorkOrder(actor, params.id, { to: 'AUTHORIZED' });
    return ok({ workOrder: row });
  },
});
