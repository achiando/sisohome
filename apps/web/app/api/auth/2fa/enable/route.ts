import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';
import { generateRecoveryCodes, hashRecoveryCode, verifyTotpToken } from '@/lib/two-factor';

/**
 * POST /api/auth/2fa/enable
 *
 * Step 2 of enrolment: the user must prove they scanned the QR by returning
 * a live code. Only then is 2FA switched on, and recovery codes are issued
 * (returned exactly once — they are stored hashed).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

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
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: 'Run setup first to scan the QR code.' },
        { status: 400 }
      );
    }

    const valid = await verifyTotpToken(token, user.twoFactorSecret);
    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'That code was not accepted. Wait for a fresh code and try again.',
        },
        { status: 400 }
      );
    }

    const recoveryCodes = generateRecoveryCodes();

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorMethod: 'TOTP',
          twoFactorConfirmedAt: new Date(),
        },
      }),
      db.userRecoveryCode.deleteMany({ where: { userId: user.id } }),
      db.userRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          userId: user.id,
          codeHash: hashRecoveryCode(code),
        })),
      }),
    ]);

    return NextResponse.json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('2FA enable error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not enable two-factor authentication' },
      { status: 500 }
    );
  }
}
