import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authorizationService, db } from '@/lib/auth';
import {
  clearTwoFactorPendingCookie,
  setActiveOrgCookie,
  setSessionCookie,
} from '@/lib/session-cookie';
import { decodePendingTwoFactor, hashRecoveryCode, verifyTotpToken } from '@/lib/two-factor';
import { redeemEmailOtp } from '@/lib/email-otp';

/**
 * POST /api/auth/2fa/verify
 *
 * Step 2 of sign-in. Accepts a live authenticator code or an unused recovery
 * code and, only on success, issues the real session cookie. The pending
 * token proves the password step already passed, so this endpoint never
 * sees a password.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const pending = decodePendingTwoFactor(request.cookies.get('siso_2fa_pending')?.value);
    if (!pending) {
      const expired = NextResponse.json(
        { success: false, error: 'Your sign-in attempt expired. Please sign in again.' },
        { status: 401 }
      );
      clearTwoFactorPendingCookie(expired);
      return expired;
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const recoveryCode = typeof body?.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
    if (!token && !recoveryCode) {
      return NextResponse.json({ success: false, error: 'Enter your code.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: pending.userId },
      include: { profile: true },
    });
    if (!user || user.status !== 'ACTIVE' || !user.twoFactorEnabled) {
      const rejected = NextResponse.json(
        { success: false, error: 'Two-factor authentication is not available.' },
        { status: 400 }
      );
      clearTwoFactorPendingCookie(rejected);
      return rejected;
    }

    let valid = false;
    if (recoveryCode) {
      valid = await redeemRecoveryCode(user.id, recoveryCode);
    } else if (user.twoFactorMethod === 'EMAIL') {
      valid = await redeemEmailOtp(user.id, 'TWO_FACTOR_LOGIN', token);
    } else {
      valid = user.twoFactorSecret
        ? await verifyTotpToken(token, user.twoFactorSecret)
        : false;
    }

    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'That code was not accepted. Try again.' },
        { status: 401 }
      );
    }

    const identity = await authProvider.issueSession(user.id);
    if (!identity?.sessionId) {
      return NextResponse.json({ success: false, error: 'Sign-in failed' }, { status: 500 });
    }

    const session = await db.session.findUnique({ where: { id: identity.sessionId } });
    const organizationId = (identity.metadata?.organizationId as string | null) ?? null;

    const permissions = organizationId
      ? await authorizationService.getUserPermissions(user.id, organizationId)
      : [];
    const roles = organizationId
      ? await authorizationService.getUserRoles(user.id, organizationId)
      : [];

    const response = NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        name:
          user.displayName ||
          `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim(),
        avatar: user.profile?.avatarUrl ?? undefined,
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

    if (session?.token) {
      setSessionCookie(response, session.token);
      setActiveOrgCookie(response, organizationId);
    }
    clearTwoFactorPendingCookie(response);

    return response;
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ success: false, error: 'Sign-in failed' }, { status: 500 });
  }
}

/** Consume a backup code exactly once; rejects reused or unknown codes. */
async function redeemRecoveryCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashRecoveryCode(code);
  const match = await db.userRecoveryCode.findFirst({
    where: { userId, codeHash, usedAt: null },
  });
  if (!match) return false;

  const claimed = await db.userRecoveryCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1;
}
