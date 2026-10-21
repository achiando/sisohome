import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * POST /api/work-orders/[id]/transition — `{ to }` against
 * WORK_ORDER_TRANSITIONS; COMPLETED stamps completedAt (+ optional
 * finalCost) and auto-completes open assignments (plan §3).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'work_order.update',
  async handler({ actor, params, body }) {
    const input = (await body()) ?? {};
    if (typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await workOrder.transitionWorkOrder(actor, params.id, input);
    return ok({ workOrder: row });
  },
});
