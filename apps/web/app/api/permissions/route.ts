import { orgRoleService } from '@/lib/auth';
import { apiRoute } from '@/lib/api-route';

/**
 * GET /api/permissions — global permission catalog, grouped by resource.
 * Drives the role-permission matrix UI. Non-sensitive: any authenticated
 * member of an organization may read it (matrix is visible to owners via
 * role.read, but the catalog itself leaks nothing org-specific).
 */
export const GET = apiRoute({
  async handler() {
    const catalog = await orgRoleService.listPermissionCatalog();
    return { permissions: catalog };
  },
});
