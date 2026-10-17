import { NextRequest, NextResponse } from 'next/server';

import { authProvider, db } from '@/lib/auth';
import { findValidResetToken } from '@/lib/password-reset';

/**
 * POST /api/auth/new-password — complete a reset with the emailed token.
 *
 * The token is single-use: it is marked used and every other outstanding link
 * for the account is destroyed. Existing sessions are revoked too — someone
 * who needed a reset link may have been locked out of a hijacked session, so
 * old sessions must not survive the password change.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'token and password are required' },
        { status: 400 },
      );
    }

    const record = await findValidResetToken(token);
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'This reset link is invalid or has expired.' },
        { status: 400 },
      );
    }

    try {
      const ok = await authProvider.setPassword(record.userId, password);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'This reset link is invalid or has expired.' },
          { status: 400 },
        );
      }
    } catch (err) {
      // Password policy failures — surfaced so the form can show them.
      const message = err instanceof Error ? err.message : 'Password could not be changed';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    await db.$transaction([
      db.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      db.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
      }),
      db.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('New password error:', error);
    return NextResponse.json({ success: false, error: 'Password could not be changed' }, { status: 500 });
  }
}
