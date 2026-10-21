import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * POST /api/work-orders/[id]/assign — `{ assigneeUserId,
 * assigneeOrganizationId? }`. THE cross-org hook (plan §3): an explicit
 * external org id hands the job (and arm-4 property reach) to that org —
 * no agreement required; the assignment IS the grant.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'work_order.assign',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const assignment = await workOrder.assignWorkOrder(actor, params.id, input);
    return ok({ assignment }, { status: 201 });
  },
});
