import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@workspace/email';
import { membershipService, db } from '@/lib/auth';
import { appUrl } from '@/lib/base-url';
import { memberAddedEmail } from '@/lib/email/member-added';
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

    // Email the newcomer their temporary password — the admin still sees it
    // once in the response, but nobody has to relay secrets manually.
    // Fire and forget: delivery problems never fail member creation.
    void (async () => {
      try {
        const [organization, inviter] = await Promise.all([
          db.organization.findUnique({
            where: { id: context.organizationId! },
            select: { name: true },
          }),
          db.user.findUnique({
            where: { id: context.userId },
            select: { displayName: true },
          }),
        ]);
        await sendEmail(
          memberAddedEmail({
            to: email,
            recipientName: name,
            inviterName: inviter?.displayName ?? undefined,
            organizationName: organization?.name ?? 'this workspace',
            tempPassword: result.tempPassword,
            signInUrl: `${appUrl()}/login`,
          }),
        );
      } catch (error) {
        console.error('Member invitation email failed:', error);
      }
    })();

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
