import { sendEmail } from '@workspace/email';
import { membershipService, db } from '@/lib/auth';
import { appUrl } from '@/lib/base-url';
import { memberAddedEmail } from '@/lib/email/member-added';
import { apiRoute, ok, RouteError } from '@/lib/api-route';

/**
 * GET /api/members — list the active organization's members with roles.
 */
export const GET = apiRoute({
  permissions: 'user.read',
  async handler({ actor }) {
    const members = await membershipService.listMembers(actor.organizationId);
    return { members };
  },
});

/**
 * POST /api/members — admin create-user-with-roles. The generated temporary
 * password is returned ONCE for the admin to pass along; the user must
 * change it on first login.
 */
export const POST = apiRoute({
  permissions: ['user.create', 'membership.invite'],
  async handler({ actor, body }) {
    const input = await body();
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const roleIds = Array.isArray(input?.roleIds)
      ? input.roleIds.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    if (!email || !name) {
      throw new RouteError(400, 'Email and name are required');
    }

    const result = await membershipService.createUserWithRoles(actor, { email, name, roleIds });

    // Email the newcomer their temporary password — the admin still sees it
    // once in the response, but nobody has to relay secrets manually.
    // Fire and forget: delivery problems never fail member creation.
    void (async () => {
      try {
        const [organization, inviter] = await Promise.all([
          db.organization.findUnique({
            where: { id: actor.organizationId },
            select: { name: true },
          }),
          db.user.findUnique({
            where: { id: actor.userId },
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

    // tempPassword is shown once — never retrievable again
    return ok({ userId: result.userId, tempPassword: result.tempPassword }, { status: 201 });
  },
});
