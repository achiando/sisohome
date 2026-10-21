import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * POST /api/staff-assignments/[id]/revoke — symmetric revoke path
 * (same service as the nested DELETE; scope still proven via the parent).
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'property.update',
  async handler({ actor, params }) {
    const assignment = await agreements.revokeStaff(actor, params.id);
    return { assignment };
  },
});
