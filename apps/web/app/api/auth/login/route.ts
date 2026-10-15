import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authorizationService, db } from '@/lib/auth';

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

    // Get session token
    const session = await db.session.findUnique({
      where: { id: identity.sessionId },
    });

    // Get permissions and roles
    const organizationId = identity.metadata?.organizationId as string | null;
    const permissions = await authorizationService.getUserPermissions(identity.userId, organizationId || undefined);
    const roles = await authorizationService.getUserRoles(identity.userId, organizationId || undefined);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        avatar: user.profile?.avatarUrl,
      },
      session: {
        token: session?.token,
        expiresAt: session?.expiresAt?.toISOString(),
        organizationId,
        permissions,
        roles: roles.map(r => r.slug),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
