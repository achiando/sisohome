import { NextRequest, NextResponse } from 'next/server';
import { membershipService } from '@/lib/auth';
import { withAuth } from '@/lib/route-auth';

/**
 * GET /api/members — list the active organization's members with roles.
 */
export const GET = withAuth(
  async (_request, context) => {
    const members = await membershipService.listMembers(context.organizationId!);
    return NextResponse.json({ success: true, members });
  },
  { requiredPermissions: ['user.read'] },
);

/**
 * POST /api/members — admin create-user-with-roles. The generated temporary
 * password is returned ONCE for the admin to pass along; the user must
 * change it on first login.
 */
export const POST = withAuth(
  async (request, context) => {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const roleIds = Array.isArray(body?.roleIds)
      ? body.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Email and name are required' }, { status: 400 });
    }

    const result = await membershipService.createUserWithRoles(
      { userId: context.userId, organizationId: context.organizationId! },
      { email, name, roleIds },
    );
    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        // Shown once — never retrievable again
        tempPassword: result.tempPassword,
      },
      { status: 201 },
    );
  },
  { requiredPermissions: ['user.create', 'membership.invite'] },
);
