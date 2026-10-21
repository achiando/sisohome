import { apiRoute } from '@/lib/api-route';
import * as agreements from '@/lib/domain/agreement';

/**
 * DELETE /api/properties/[id]/staff/[assignmentId] — revoke = flip
 * `isActive=false` (history preserved, never a hard delete).
 */
export const DELETE = apiRoute<{ id: string; assignmentId: string }>({
  permissions: 'property.update',
  async handler({ actor, params }) {
    const assignment = await agreements.revokeStaff(actor, params.assignmentId);
    return { assignment };
  },
});
