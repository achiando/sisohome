import { NextRequest, NextResponse } from 'next/server';
import { maskEmail } from '@workspace/email';
import { db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';
import { EMAIL_OTP_TTL_MINUTES, issueEmailOtp } from '@/lib/email-otp';
import {
  buildOtpauthUri,
  encryptSecret,
  generateTotpSecret,
  renderQrDataUri,
} from '@/lib/two-factor';

/**
 * POST /api/auth/2fa/setup
 *
 * Step 1 of enrolment: generate the TOTP secret, store it ENCRYPTED, and hand
 * back a QR + the manual-entry key so the user can scan it in Google
 * Authenticator (or any other authenticator app).
 *
 * The account stays unprotected until /enable sees a valid code, so a
 * half-finished setup can never lock anyone out.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: context.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: 'Two-factor authentication is already on.' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const method = body?.method === 'EMAIL' ? 'EMAIL' : 'TOTP';

    // Email channel: no secret to store — the proof is a code sent to the
    // account address, so setup issues it and /enable checks it.
    if (method === 'EMAIL') {
      await issueEmailOtp(user.id, 'TWO_FACTOR_ENROL');
      return NextResponse.json({
        success: true,
        method: 'EMAIL',
        email: maskEmail(user.email),
        expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
      });
    }

    const secret = generateTotpSecret();
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptSecret(secret) },
    });

    const otpauthUri = buildOtpauthUri(user.email, secret);
    const qrDataUri = await renderQrDataUri(otpauthUri);

    return NextResponse.json({
      success: true,
      email: user.email,
      // The user's own secret, over TLS, to display the manual-entry key.
      secret,
      otpauthUri,
      qrDataUri,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not start two-factor setup' },
      { status: 500 }
    );
  }
}
