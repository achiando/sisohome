import { apiRoute } from '@/lib/api-route';
import * as workOrder from '@/lib/domain/work-order';

/**
 * GET /api/work-order-assignees — assign-dialog directory (plan-slice-3 §6
 * open item): related orgs (agreements either side + prior assignments,
 * both directions) + ACTIVE members (own org, or a related org via
 * `?organizationId=` — 404 for unrelated orgs, so this can never be used
 * to enumerate foreign workspaces). Gated `work_order.assign`.
 */
export const GET = apiRoute({
  permissions: 'work_order.assign',
  async handler({ actor, query }) {
    const { organizations, members } = await workOrder.listAssigneeCandidates(
      actor,
      query.get('organizationId'),
    );
    return { organizations, members };
  },
});
