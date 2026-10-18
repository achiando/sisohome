import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@workspace/email';

import { authProvider, db } from '@/lib/auth';
import { verifyEmailTemplate } from '@/lib/email/verify-email';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  issueVerificationToken,
  verificationUrl,
} from '@/lib/verify-email';
import { checkRateLimits, ipKey } from '@/lib/rate-limit';
import { consentMetadata, recordConsents } from '@/lib/consent';

/**
 * POST /api/auth/signup — account creation gated by email verification.
 *
 * Creates the user unverified and deliberately issues NO session: the
 * emailed single-use link is the only way in, so onboarding cannot be
 * reached with an unproven address. The response tells the client to show
 * "check your email" instead of routing anywhere.
 *
 * Consent (Terms + Privacy, versioned) is mandatory and recorded with the
 * request's IP/user-agent before the verification email goes out.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Each signup mails a verification link — cap per IP.
    const limited = checkRateLimits([
      { key: ipKey(request, 'signup'), limit: 10, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = await request.json();
    const { name, email, password, acceptTerms } = body;

    // Server-side consent gate — the form checkbox is UX, not proof.
    if (acceptTerms !== true) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must accept the Terms of Service and Privacy Policy',
        },
        { status: 400 }
      );
    }

    const identity = await authProvider.signUp(email, password, name);

    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      );
    }

    // The consent record is part of account creation: if it cannot be
    // written, roll the user back exactly like an email failure.
    try {
      await recordConsents(identity.userId, consentMetadata(request));
    } catch (error) {
      console.error('Consent record failed:', error);
      await db.user.delete({ where: { id: identity.userId } }).catch(() => undefined);
      return NextResponse.json(
        { success: false, error: 'Sign up failed. Please try again.' },
        { status: 500 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: identity.userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User creation failed' },
        { status: 500 }
      );
    }

    // Delivery is awaited so a failure is reported — and the just-created
    // account is rolled back, so the same address can simply sign up again.
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
      console.error('Verification email failed:', error);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          error: 'We could not send the verification email. Please try again.',
        },
        { status: 500 }
      );
    }

    // No cookies: nothing to route to until the link is clicked.
    return NextResponse.json({
      success: true,
      verificationRequired: true,
      onboardingRequired: true,
      email: user.email,
    });
  } catch (error) {
    console.error('Sign up error:', error);
    return NextResponse.json(
      { success: false, error: 'Sign up failed' },
      { status: 500 }
    );
  }
}
