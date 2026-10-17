import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authorizationService, db } from '@/lib/auth';
import { setSessionCookie, setActiveOrgCookie } from '@/lib/session-cookie';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Login using password provider
    const identity = await authProvider.login(email, password);

    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get user details
    const user = await db.user.findUnique({
      where: { id: identity.userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get session details (token is set as an httpOnly cookie, never returned in body)
    const session = await db.session.findUnique({
      where: { id: identity.sessionId },
    });

    const organizationId = (identity.metadata?.organizationId as string | null) ?? null;

    // Get permissions and roles for the active organization (if any)
    const permissions = organizationId
      ? await authorizationService.getUserPermissions(identity.userId, organizationId)
      : [];
    const roles = organizationId
      ? await authorizationService.getUserRoles(identity.userId, organizationId)
      : [];

    const response = NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        avatar: user.profile?.avatarUrl,
      },
      session: {
        expiresAt: session?.expiresAt?.toISOString(),
        organizationId,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });

    // Persist session token in httpOnly cookie + active org for proxy routing
    if (session?.token) {
      setSessionCookie(response, session.token);
      setActiveOrgCookie(response, organizationId);
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
