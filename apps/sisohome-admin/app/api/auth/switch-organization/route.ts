import { NextRequest, NextResponse } from 'next/server';
import { authService, authorizationService, db, getSessionToken } from '@/lib/auth';
import { setSessionCookie, setActiveOrgCookie } from '@/lib/session-cookie';

/**
 * Switch the active organization for the current session.
 * Validates the user actually has an ACTIVE membership in the target org,
 * then persists the new context on the session + cookies. The client re-reads
 * permissions from the returned session — the cookie is only an optimistic
 * routing hint for proxy.ts, never an authorization source.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : null;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Resolve the session
    const identity = await authService.verifySession(token);

    // Validate the user has an ACTIVE membership in the target organization
    const membership = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: identity.userId },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Not a member of that organization' },
        { status: 403 }
      );
    }

    // Persist the new active organization on the session
    if (identity.sessionId) {
      await db.session.update({
        where: { id: identity.sessionId },
        data: { organizationId },
      });
    }

    const user = await db.user.findUnique({
      where: { id: identity.userId },
      include: { profile: true },
    });

    const session = identity.sessionId
      ? await db.session.findUnique({ where: { id: identity.sessionId } })
      : null;

    const permissions = await authorizationService.getUserPermissions(identity.userId, organizationId);
    const roles = await authorizationService.getUserRoles(identity.userId, organizationId);

    const response = NextResponse.json({
      success: true,
      // Kept so client state never loses the forced-change flag on switch.
      mustChangePassword: user?.mustChangePassword,
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
        organizationId,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });

    // Refresh both cookies to match the new context
    if (session?.token) {
      setSessionCookie(response, session.token);
      setActiveOrgCookie(response, organizationId);
    }

    return response;
  } catch (error) {
    console.error('Switch organization error:', error);
    return NextResponse.json({ success: false, error: 'Switch organization failed' }, { status: 500 });
  }
}
