import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as maintenance from '@/lib/domain/maintenance';

/**
 * GET /api/maintenance/tickets/[id] — detail. Assignee contact details are
 * included only when the caller ALSO holds `user.read` (plan §3 mask rule).
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'maintenance.read',
  async handler({ actor, ctx, params }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const row = await maintenance.getTicket(actor, params.id, {
      includeAssigneeContacts: granted.includes('user.read' as never),
    });
    return { ticket: row };
  },
});

/** PATCH /api/maintenance/tickets/[id] — fetch → scope → updateMany. */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'maintenance.update',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await maintenance.updateTicket(actor, params.id, input);
    return ok({ ticket: row });
  },
});
