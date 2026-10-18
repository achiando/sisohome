import { NextResponse } from 'next/server';
import { authService, authorizationService, db, getSessionToken } from '@/lib/auth';
import { needsConsents } from '@/lib/consent';

export async function GET() {
  try {
    // Session token comes from the httpOnly cookie — never from JS-readable
    // storage or an Authorization header the client would have to persist.
    const token = await getSessionToken();

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

    const session = identity.sessionId
      ? await db.session.findUnique({ where: { id: identity.sessionId } })
      : null;

    const organizationId = (identity.metadata?.organizationId as string | null) ?? null;

    // Permissions/roles are scoped to the active organization (null while the
    // user still needs onboarding).
    const permissions = organizationId
      ? await authorizationService.getUserPermissions(identity.userId, organizationId)
      : [];
    const roles = organizationId
      ? await authorizationService.getUserRoles(identity.userId, organizationId)
      : [];

    return NextResponse.json({
      success: true,
      // Mirrored at the top level so AuthResponse consumers (AuthContext)
      // can enforce the forced password change on session restore.
      mustChangePassword: user.mustChangePassword,
      // True while any required document (Terms/Privacy) is unaccepted at
      // its current version — the change-password screen shows the opt-in.
      needsConsent: await needsConsents(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        avatar: user.profile?.avatarUrl,
        phone: user.phone,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
      },
      session: {
        expiresAt: session?.expiresAt?.toISOString(),
        organizationId,
        permissions,
        roles: roles.map((r) => r.slug),
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ success: false });
  }
}
