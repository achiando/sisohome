import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/** GET /api/work-orders/[id] — detail (+ assignments/inspections). Assignee
 * contact details require `user.read` (plan §3 mask rule). */
export const GET = apiRoute<{ id: string }>({
  permissions: 'work_order.read',
  async handler({ actor, ctx, params }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const row = await workOrder.getWorkOrder(actor, params.id, {
      includeAssigneeContacts: granted.includes('user.read' as never),
    });
    return { workOrder: row };
  },
});

/** PATCH /api/work-orders/[id] — costs/dates/notes (pre-terminal only). */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'work_order.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await workOrder.updateWorkOrder(actor, params.id, input);
    return ok({ workOrder: row });
  },
});
