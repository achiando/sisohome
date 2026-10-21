import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as application from '@/lib/domain/application';

/**
 * POST /api/applications/[id]/decision — approve or reject (plan-slice-2 §2.2).
 * Body `{ decision: 'APPROVED'|'REJECTED', leaseId? }`. Sets decidedAt +
 * decidedByUserId; approve flips the tenant to ACTIVE. Single-use (409).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'application.approve',
  async handler({ actor, params, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await application.decideApplication(actor, params.id, input);
    return ok({ application: row });
  },
});
