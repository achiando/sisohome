import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authorizationService, db } from '@/lib/auth';
import { setSessionCookie, setActiveOrgCookie, setTwoFactorPendingCookie } from '@/lib/session-cookie';
import { issueEmailOtp } from '@/lib/email-otp';
import { notifyNewLogin } from '@/lib/login-alert';
import { encodePendingTwoFactor } from '@/lib/two-factor';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password } = body;

    // ── Second factor first, before a session exists ──────────────────────
    // Password-only users fall through to the normal path below. When 2FA is
    // on we prove the password WITHOUT creating a session and return a
    // short-lived pending token for /api/auth/2fa/verify. Failure messages
    // are identical to a bad password so we don't leak which accounts are
    // protected.
    const candidate = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, twoFactorEnabled: true, twoFactorMethod: true, emailVerifiedAt: true },
    });

    // Signup is gated on the emailed verification link — an unproven address
    // never reaches password checks, OTP sends or a session.
    if (candidate && !candidate.emailVerifiedAt) {
      return NextResponse.json(
        {
          success: false,
          needsVerification: true,
          email: candidate.email,
          error:
            'Your email address is not verified yet. Check your inbox for the verification link.',
        },
        { status: 401 }
      );
    }

    if (candidate?.twoFactorEnabled) {
      const passwordOk = await authProvider.verifyPassword(email, password);
      if (!passwordOk) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Email channel: the second factor is a code, so send it now — after the
      // password was proved, so the endpoint can't be used to spam inboxes.
      let twoFactorChannel: 'totp' | 'email' = 'totp';
      if (candidate.twoFactorMethod === 'EMAIL') {
        try {
          await issueEmailOtp(candidate.id, 'TWO_FACTOR_LOGIN');
          twoFactorChannel = 'email';
        } catch (error) {
          console.error('Sign-in code email failed:', error);
          return NextResponse.json(
            { success: false, error: 'Could not send a sign-in code. Try again.' },
            { status: 500 }
          );
        }
      }

      const pending = NextResponse.json({
        success: true,
        twoFactorRequired: true,
        twoFactorChannel,
      });
      setTwoFactorPendingCookie(pending, encodePendingTwoFactor(candidate.id));
      return pending;
    }

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

    // Persist session token in httpOnly cookie + active org for proxy routing
    if (session?.token) {
      setSessionCookie(response, session.token);
      setActiveOrgCookie(response, organizationId);
    }

    // Tell the owner about the sign-in (device + location). Fire and forget —
    // a slow geo lookup must never delay the response.
    void notifyNewLogin(request, { email: user.email, displayName: user.displayName });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
