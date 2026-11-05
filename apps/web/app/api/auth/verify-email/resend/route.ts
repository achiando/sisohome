import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@workspace/email';
import { db } from '@/lib/auth';
import { verifyEmailTemplate } from '@/lib/email/verify-email';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  issueVerificationToken,
  verificationUrl,
  generateVerificationCode,
} from '@/lib/verify-email';
import { checkRateLimits, ipKey } from '@/lib/rate-limit';

/**
 * POST /api/auth/verify-email/resend — send a fresh link for an address
 * that is still unverified.
 *
 * Always answers success so the endpoint can't be used to discover which
 * addresses have accounts; send failures are logged, not surfaced.
 * When EMAIL_TRANSPORT=outbox, also include a 6-digit code for manual entry.
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

    let persistedCode: string | undefined;
    if (user && user.status === 'ACTIVE' && !user.emailVerifiedAt) {
      try {
        // Persists token-hash + 6-digit code; return both so the response can
        // carry the SAME code that was stored (redeemable via the by-code API).
        const { token, code } = await issueVerificationToken(user.id);
        persistedCode = code;
        await sendEmail(
          verifyEmailTemplate({
            to: user.email,
            verifyUrl: verificationUrl(token),
            expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
            recipientName: user.displayName ?? undefined,
            code,
          })
        );
      } catch (error) {
        console.error('Verification resend failed:', error);
        persistedCode = undefined;
      }
    }

    // Return success and optionally a code for outbox transport. The code is
    // the one actually stored above; the fallback keeps the enumeration-safe
    // response shape identical when nothing was persisted (unknown address).
    //
    // SAFETY: the code may only ever be echoed in dev. Even if production is
    // misconfigured with EMAIL_TRANSPORT=outbox, NODE_ENV=production blocks
    // it — otherwise anyone could type a victim's address and receive their
    // verification code in this response.
    const response: { success: boolean; code?: string } = { success: true };
    if (
      process.env.EMAIL_TRANSPORT === 'outbox' &&
      process.env.NODE_ENV !== 'production'
    ) {
      response.code = persistedCode ?? generateVerificationCode();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Verification resend error:', error);
    return NextResponse.json({ success: true });
  }
}
