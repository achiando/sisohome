import { orgRoleService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';

/**
 * GET /api/roles — list the active organization's roles (templates + custom)
 * with permission keys and member counts. Source for the permission matrix.
 */
export const GET = apiRoute({
  permissions: 'role.read',
  async handler({ actor }) {
    const roles = await orgRoleService.listRoles(actor.organizationId);
    return { roles };
  },
});

/**
 * POST /api/roles — create a custom (non-template) role. Permissions are a
 * replace-set and may only include permissions the caller holds.
 */
export const POST = apiRoute({
  permissions: 'role.manage',
  async handler({ actor, body }) {
    const input = await body();
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const slug = typeof input?.slug === 'string' ? input.slug.trim() : '';
    const description = typeof input?.description === 'string' ? input.description : undefined;
    const permissions = Array.isArray(input?.permissions)
      ? input.permissions.filter((p: unknown): p is string => typeof p === 'string')
      : [];

    if (!name || !slug) {
      throw new RouteError(400, 'Name and slug are required');
    }

    const role = await orgRoleService.createRole(actor, { name, slug, description, permissions });
    return ok({ role }, { status: 201 });
  },
});
