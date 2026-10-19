import { membershipService } from '@/lib/auth';
import { apiRoute, RouteError } from '@/lib/api-route';

/**
 * POST /api/members/[id]/roles — assign roles to a member.
 * Guards: caller must hold every assigned role; roles must belong to the
 * active organization (or be system roles); cross-org assignment impossible.
 */
export const POST = apiRoute<{ id: string }>({
  permissions: 'role.assign',
  async handler({ actor, params, body }) {
    const input = await body();
    const roleIds = Array.isArray(input?.roleIds)
      ? input.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (roleIds.length === 0) {
      throw new RouteError(400, 'roleIds is required');
    }

    await membershipService.assignRoles(actor, params.id, roleIds);
  },
});

/**
 * DELETE /api/members/[id]/roles — revoke roles from a member.
 * Last-active-owner protection: cannot revoke the final owner role.
 */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'role.revoke',
  async handler({ actor, params, body }) {
    const input = await body();
    const roleIds = Array.isArray(input?.roleIds)
      ? input.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (roleIds.length === 0) {
      throw new RouteError(400, 'roleIds is required');
    }

    await membershipService.revokeRoles(actor, params.id, roleIds);
  },
});
