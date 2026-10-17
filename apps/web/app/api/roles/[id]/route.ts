import { NextRequest, NextResponse } from 'next/server';
import { orgRoleService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/roles/[id] — one role with its permission keys.
 */
export const GET = withAuth(
  async (_request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    const roles = await orgRoleService.listRoles(context.organizationId!);
    const role = roles.find((r) => r.id === id);
    if (!role) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, role });
  },
  { requiredPermissions: ['role.read'] },
);

/**
 * PATCH /api/roles/[id] — update a role. Custom roles: name/description/
 * permissions. Template roles: permissions only. System roles: read-only.
 */
export const PATCH = withAuth(
  async (request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const input: { name?: string; description?: string; permissions?: string[] } = {};
    if (typeof body?.name === 'string') input.name = body.name;
    if (typeof body?.description === 'string') input.description = body.description;
    if (Array.isArray(body?.permissions)) {
      input.permissions = body.permissions.filter(
        (p: unknown): p is string => typeof p === 'string',
      );
    }

    const role = await orgRoleService.updateRole(
      { userId: context.userId, organizationId: context.organizationId! },
      id,
      input,
    );
    return NextResponse.json({ success: true, role });
  },
  { requiredPermissions: ['role.manage'] },
);

/**
 * DELETE /api/roles/[id] — delete a custom role. Template/system roles are
 * never deletable; roles with assigned members must be reassigned first.
 */
export const DELETE = withAuth(
  async (_request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    await orgRoleService.deleteRole(
      { userId: context.userId, organizationId: context.organizationId! },
      id,
    );
    return NextResponse.json({ success: true });
  },
  { requiredPermissions: ['role.manage'] },
);
