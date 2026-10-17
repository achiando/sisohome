import { NextRequest, NextResponse } from 'next/server';
import { authProvider, db } from '@/lib/auth';
import { getRouteAuthContext } from '@/lib/route-auth';

/**
 * POST /api/auth/2fa/disable
 *
 * Turning off a second factor requires re-entering the account password —
 * a stolen session alone must not be enough to drop protection. The pending
 * enrolment secret and all recovery codes are wiped in the same transaction.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getRouteAuthContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    const user = await db.user.findUnique({ where: { id: context.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: 'Two-factor authentication is not on.' },
        { status: 400 }
      );
    }

    const passwordOk = await authProvider.verifyPassword(user.email, password);
    if (!passwordOk) {
      return NextResponse.json({ success: false, error: 'Password is incorrect.' }, { status: 401 });
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorMethod: null,
          twoFactorSecret: null,
          twoFactorConfirmedAt: null,
        },
      }),
      db.userRecoveryCode.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not disable two-factor authentication' },
      { status: 500 }
    );
  }
}
