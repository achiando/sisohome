import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * GET /api/work-orders — register (parent scope; MM reaches via arm 4/2).
 * `?scope=mine` filters to rows assigned to the caller (UX filter, plan §1).
 */
export const GET = apiRoute({
  permissions: 'work_order.list',
  async handler({ actor, query }) {
    const workOrders = await workOrder.listWorkOrders(actor, {
      status: query.get('status') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
      scope: query.get('scope') ?? undefined,
    });
    return { workOrders };
  },
});

/** POST /api/work-orders — standalone WO (ticket link optional). */
export const POST = apiRoute({
  permissions: 'work_order.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await workOrder.createWorkOrder(actor, input);
    return ok({ workOrder: row }, { status: 201 });
  },
});
