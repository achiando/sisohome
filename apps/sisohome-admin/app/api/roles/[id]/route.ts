import { orgRoleService } from '@/lib/auth';
import { apiRoute, RouteError } from '@/lib/api-route';

/**
 * GET /api/roles/[id] — one role with its permission keys.
 */
export const GET = apiRoute<{ id: string }>({
  permissions: 'role.read',
  async handler({ actor, params }) {
    const roles = await orgRoleService.listRoles(actor.organizationId);
    const role = roles.find((r) => r.id === params.id);
    if (!role) {
      throw new RouteError(404, 'Role not found');
    }
    return { role };
  },
});

/**
 * PATCH /api/roles/[id] — update a role. Custom roles: name/description/
 * permissions. Template roles: permissions only. System roles: read-only.
 */
export const PATCH = apiRoute<{ id: string }>({
  permissions: 'role.manage',
  async handler({ actor, params, body }) {
    const input = await body();
    const update: { name?: string; description?: string; permissions?: string[] } = {};
    if (typeof input?.name === 'string') update.name = input.name;
    if (typeof input?.description === 'string') update.description = input.description;
    if (Array.isArray(input?.permissions)) {
      update.permissions = input.permissions.filter(
        (p: unknown): p is string => typeof p === 'string',
      );
    }

    const role = await orgRoleService.updateRole(actor, params.id, update);
    return { role };
  },
});

/**
 * DELETE /api/roles/[id] — delete a custom role. Template/system roles are
 * never deletable; roles with assigned members must be reassigned first.
 */
export const DELETE = apiRoute<{ id: string }>({
  permissions: 'role.manage',
  async handler({ actor, params }) {
    await orgRoleService.deleteRole(actor, params.id);
  },
});
