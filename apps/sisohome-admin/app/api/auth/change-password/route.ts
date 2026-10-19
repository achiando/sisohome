import { NextRequest, NextResponse } from 'next/server';
import { authProvider, authService, db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';
import { consentMetadata, needsConsents, recordConsents } from '@/lib/consent';

/**
 * POST /api/auth/change-password — change the signed-in user's password.
 * Required when `mustChangePassword` is set (admin-created temporary
 * password); clears the flag on success.
 *
 * Also the consent gate for users who never went through signup (invited
 * members): while any required document is unaccepted at the current
 * version, `acceptTerms: true` must accompany the change.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    const acceptTerms = body?.acceptTerms === true;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'currentPassword and newPassword are required' },
        { status: 400 },
      );
    }

    // Consent gate: invited users (and anyone facing a policy update)
    // must accept BEFORE the change — a 400 after the hash was rewritten
    // would leave the user retrying with a "current" password they no
    // longer know. Nothing is mutated until consent is in place.
    const consentNeeded = await needsConsents(context.userId);
    if (consentNeeded && !acceptTerms) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must accept the Terms of Service and Privacy Policy',
          needsConsent: true,
        },
        { status: 400 },
      );
    }

    try {
      const ok = await authProvider.changePassword(context.userId, currentPassword, newPassword);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 400 },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    if (consentNeeded) {
      await recordConsents(context.userId, consentMetadata(request));
    }

    // A password change is a security event: every OTHER session dies
    // (the current one stays so the user isn't logged out mid-flow).
    await db.session.deleteMany({
      where: {
        userId: context.userId,
        ...(context.sessionId ? { id: { not: context.sessionId } } : {}),
      },
    });

    return NextResponse.json({ success: true, mustChangePassword: false });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, error: 'Password change failed' }, { status: 500 });
  }
}

/**
 * GET /api/auth/change-password — probe endpoint (session validity only).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ success: true });
}
