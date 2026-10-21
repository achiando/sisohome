import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/** GET /api/maintenance/tickets — board/queue (property-scoped; MM via arm 4/2). */
export const GET = apiRoute({
  permissions: 'maintenance.list',
  async handler({ actor, query }) {
    const tickets = await maintenance.listTickets(actor, {
      status: query.get('status') ?? undefined,
      priority: query.get('priority') ?? undefined,
      category: query.get('category') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
    });
    return { tickets };
  },
});

/** POST /api/maintenance/tickets — report an issue (actor recorded as reporter). */
export const POST = apiRoute({
  permissions: 'maintenance.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.createTicket(actor, input);
    return ok({ ticket: row }, { status: 201 });
  },
});
