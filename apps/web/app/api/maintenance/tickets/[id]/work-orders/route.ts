import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';
import * as workOrder from '@/lib/domain/work-order';

/**
 * POST /api/maintenance/tickets/[id]/work-orders — escalate: creates a
 * PENDING work order linked to this ticket (plan §3). Ticket flips to
 * IN_PROGRESS when the WO is authorized (plan §2).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'work_order.create',
  async handler({ actor, params, body }) {
    const input = (await body()) ?? {};
    if (typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const ticket = await maintenance.getTicket(actor, params.id);
    const row = await workOrder.createWorkOrder(actor, {
      ...input,
      ticketId: ticket.id,
      propertyId: ticket.propertyId,
      unitId: ticket.unitId ?? undefined,
      title: input.title ?? ticket.title,
      priority: input.priority ?? ticket.priority,
    });
    return ok({ workOrder: row }, { status: 201 });
  },
});
