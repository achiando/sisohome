import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@workspace/email';

import { db } from '@/lib/auth';
import { verifyEmailTemplate } from '@/lib/email/verify-email';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  issueVerificationToken,
  verificationUrl,
} from '@/lib/verify-email';
import { checkRateLimits, ipKey } from '@/lib/rate-limit';

/**
 * POST /api/auth/verify-email/resend — send a fresh link for an address
 * that is still unverified.
 *
 * Always answers success so the endpoint can't be used to discover which
 * addresses have accounts; send failures are logged, not surfaced.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Inbox-flood cap — the enumeration-safe response stays identical.
    const limited = checkRateLimits([
      { key: ipKey(request, 'resend'), limit: 10, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ success: true });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, emailVerifiedAt: true, status: true },
    });

    if (user && user.status === 'ACTIVE' && !user.emailVerifiedAt) {
      try {
        const token = await issueVerificationToken(user.id);
        await sendEmail(
          verifyEmailTemplate({
            to: user.email,
            verifyUrl: verificationUrl(token),
            expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
            recipientName: user.displayName ?? undefined,
          }),
        );
      } catch (error) {
        console.error('Verification resend failed:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verification resend error:', error);
    return NextResponse.json({ success: true });
  }
}
