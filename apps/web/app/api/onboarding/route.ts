import { NextRequest, NextResponse } from 'next/server';
import {
  authService,
  authorizationService,
  db,
  getSessionToken,
  organizationService,
  tenantService,
} from '@/lib/auth';
import { setActiveOrgCookie } from '@/lib/session-cookie';

/**
 * Forced-password-change gate: onboarding (list/create orgs) stays blocked
 * until a temporary password is replaced — same rule as the withAuth routes.
 */
async function assertPasswordChanged(userId: string): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });
  if (user?.mustChangePassword) {
    return NextResponse.json(
      { success: false, error: 'Password change required' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * List the signed-in user's active memberships — the onboarding "pick one
 * active workspace" list and the source for the shell org switcher.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const identity = await authService.verifySession(token);
    const blocked = await assertPasswordChanged(identity.userId);
    if (blocked) return blocked;
    const memberships = await tenantService.getMemberships(identity.userId);

    return NextResponse.json({
      success: true,
      memberships,
      activeOrganizationId: (identity.metadata?.organizationId as string | null) ?? null,
    });
  } catch (error) {
    console.error('Onboarding list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list organizations' }, { status: 500 });
  }
}

/**
 * Create an organization by kind (onboarding or anytime growth via the
 * switcher). Seeds the kind's role templates, adds the creator as `owner`,
 * activates the new org on the current session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const identity = await authService.verifySession(token);
    const blocked = await assertPasswordChanged(identity.userId);
    if (blocked) return blocked;

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const kind = typeof body?.kind === 'string' ? body.kind : '';

    if (!name) {
      return NextResponse.json({ success: false, error: 'Organization name is required' }, { status: 400 });
    }

    let organization;
    try {
      organization = await organizationService.createOrganization({
        userId: identity.userId,
        name,
        kind: kind as never,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Organization creation failed';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    // Activate the new org on the current session + cookie
    if (identity.sessionId) {
      await db.session.update({
        where: { id: identity.sessionId },
        data: { organizationId: organization.id },
      });
    }

    const permissions = await authorizationService.getUserPermissions(
      identity.userId,
      organization.id,
    );
    const roles = await authorizationService.getUserRoles(identity.userId, organization.id);

    const user = await db.user.findUnique({
      where: { id: identity.userId },
      include: { profile: true },
    });
    const session = identity.sessionId
      ? await db.session.findUnique({ where: { id: identity.sessionId } })
      : null;

    const response = NextResponse.json({
      success: true,
      organization,
      user: {
        id: user?.id,
        email: user?.email,
        name:
          user?.displayName ||
          `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim(),
        avatar: user?.profile?.avatarUrl,
      },
      session: {
        expiresAt: session?.expiresAt?.toISOString(),
        organizationId: organization.id,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });

    setActiveOrgCookie(response, organization.id);
    return response;
  } catch (error) {
    console.error('Onboarding create error:', error);
    return NextResponse.json({ success: false, error: 'Organization creation failed' }, { status: 500 });
  }
}
