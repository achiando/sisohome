import { NextRequest, NextResponse } from 'next/server';
import { membershipService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/members/[id]/roles — assign roles to a member.
 * Guards: caller must hold every assigned role; roles must belong to the
 * active organization (or be system roles); cross-org assignment impossible.
 */
export const POST = withAuth(
  async (request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const roleIds = Array.isArray(body?.roleIds)
      ? body.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (roleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'roleIds is required' }, { status: 400 });
    }

    await membershipService.assignRoles(
      { userId: context.userId, organizationId: context.organizationId! },
      id,
      roleIds,
    );
    return NextResponse.json({ success: true });
  },
  { requiredPermissions: ['role.assign'] },
);

/**
 * DELETE /api/members/[id]/roles — revoke roles from a member.
 * Last-active-owner protection: cannot revoke the final owner role.
 */
export const DELETE = withAuth(
  async (request: NextRequest, context, { params }: Params) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const roleIds = Array.isArray(body?.roleIds)
      ? body.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (roleIds.length === 0) {
      return NextResponse.json({ success: false, error: 'roleIds is required' }, { status: 400 });
    }

    await membershipService.revokeRoles(
      { userId: context.userId, organizationId: context.organizationId! },
      id,
      roleIds,
    );
    return NextResponse.json({ success: true });
  },
  { requiredPermissions: ['role.revoke'] },
);
