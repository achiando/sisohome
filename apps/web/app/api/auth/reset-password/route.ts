import { NextRequest, NextResponse } from 'next/server';

import { sendEmail } from '@workspace/email';

import { db } from '@/lib/auth';
import { passwordResetEmail } from '@/lib/email/password-reset';
import { PASSWORD_RESET_TTL_MINUTES, appUrl, issueResetToken } from '@/lib/password-reset';
import { checkRateLimits, ipKey } from '@/lib/rate-limit';

/**
 * POST /api/auth/reset-password — request a reset link by email.
 *
 * Always answers `{ success: true }`, whether or not the address exists, so
 * this endpoint can never be used to test which emails have accounts.
 * Failures to actually send the mail are logged server-side only.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Inbox-flood cap: each hit mails a fresh single-use token.
    const limited = checkRateLimits([
      { key: ipKey(request, 'reset'), limit: 10, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, status: true, profile: true },
    });

    if (user && user.status === 'ACTIVE') {
      try {
        const token = await issueResetToken(user.id);
        const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail(
          passwordResetEmail({
            to: user.email,
            resetUrl,
            expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
            recipientName:
              user.displayName ||
              [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') ||
              undefined,
          }),
        );
      } catch (error) {
        // Logged, never surfaced: the response must look identical for known
        // and unknown addresses, and a transient mail failure is retryable.
        console.error('Password reset email failed:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ success: false, error: 'Reset password failed' }, { status: 500 });
  }
}
