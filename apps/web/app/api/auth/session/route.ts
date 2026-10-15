import { NextRequest, NextResponse } from 'next/server';
import { authService, authorizationService, db } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get session token from request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false });
    }

    // Verify session
    const identity = await authService.verifySession(token);

    // Get user details
    const user = await db.user.findUnique({
      where: { id: identity.userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ success: false });
    }

    // Get session details
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
    console.error('Session error:', error);
    return NextResponse.json({ success: false });
  }
}
