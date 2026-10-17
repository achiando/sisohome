import { NextResponse } from 'next/server';
import { orgRoleService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

/**
 * GET /api/roles — list the active organization's roles (templates + custom)
 * with permission keys and member counts. Source for the permission matrix.
 */
export const GET = withAuth(
  async (_request, context) => {
    const roles = await orgRoleService.listRoles(context.organizationId!);
    return NextResponse.json({ success: true, roles });
  },
  { requiredPermissions: ['role.read'] },
);

/**
 * POST /api/roles — create a custom (non-template) role. Permissions are a
 * replace-set and may only include permissions the caller holds.
 */
export const POST = withAuth(
  async (request, context) => {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
    const description = typeof body?.description === 'string' ? body.description : undefined;
    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.filter((p: unknown): p is string => typeof p === 'string')
      : [];

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
    }

    const role = await orgRoleService.createRole(
      { userId: context.userId, organizationId: context.organizationId! },
      { name, slug, description, permissions },
    );
    return NextResponse.json({ success: true, role }, { status: 201 });
  },
  { requiredPermissions: ['role.manage'] },
);
