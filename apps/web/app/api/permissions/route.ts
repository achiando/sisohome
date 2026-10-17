import { NextResponse } from 'next/server';
import { orgRoleService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

/**
 * GET /api/permissions — global permission catalog, grouped by resource.
 * Drives the role-permission matrix UI. Non-sensitive: any authenticated
 * member of an organization may read it (matrix is visible to owners via
 * role.read, but the catalog itself leaks nothing org-specific).
 */
export const GET = withAuth(async () => {
  const catalog = await orgRoleService.listPermissionCatalog();
  return NextResponse.json({ success: true, permissions: catalog });
});
