import { NextRequest, NextResponse } from 'next/server';
import { authorizationService, db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';

/**
 * GET /api/auth/profile — the signed-in user's profile + session context.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: context.userId },
      include: { profile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const permissions = context.organizationId
      ? await authorizationService.getUserPermissions(context.userId, context.organizationId)
      : [];
    const roles = context.organizationId
      ? await authorizationService.getUserRoles(context.userId, context.organizationId)
      : [];

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        name:
          user.displayName ||
          `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        avatar: user.profile?.avatarUrl,
      },
      session: {
        organizationId: context.organizationId,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/profile — update display name and/or profile fields.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : null;

    if (name === null) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: context.userId },
      data: { displayName: name },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.displayName },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Profile update failed' }, { status: 500 });
  }
}
