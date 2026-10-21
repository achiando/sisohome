import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * PATCH /api/work-order-assignments/[id] — DECLINE/COMPLETE from the
 * portfolio org, the assignee org, or the assignee person (symmetric
 * scope, plan §1/§3).
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'work_order.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await workOrder.updateAssignment(actor, params.id, input);
    return ok({ assignment: row });
  },
});
