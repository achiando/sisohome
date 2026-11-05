import { NextRequest, NextResponse } from 'next/server';

import { authProvider, authorizationService, db } from '@/lib/auth';
import { setActiveOrgCookie, setSessionCookie } from '@/lib/session-cookie';
import {
  findVerificationRecord,
  consumeVerificationRecord,
  verificationUrl,
  codeVerificationUrl,
} from '@/lib/verify-email';

/**
 * POST /api/auth/verify-email — redeem the emailed signup link (token-based).
 *
 * Consumes the single-use token, marks the address verified and issues the
 * session the signup withheld, so the client can continue into onboarding
 * already signed in.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const tokenOrCode = typeof body?.token === 'string' ? body.token.trim() : 
                       typeof body?.code === 'string' ? body.code.trim() : '';
    if (!tokenOrCode) {
      return NextResponse.json(
        { success: false, error: 'This verification link is incomplete.' },
        { status: 400 }
      );
    }

    const record = await findVerificationRecord(tokenOrCode);
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'This verification link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const consumed = await consumeVerificationRecord(tokenOrCode);
    if (!consumed) {
      // Lost the race with another click on the same link.
      return NextResponse.json(
        { success: false, error: 'This verification link has already been used.' },
        { status: 409 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: record.record.userId },
      include: { profile: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'This verification link is invalid or has expired.' },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });

    // The link is proof — sign the user in so onboarding can continue.
    const identity = await authProvider.issueSession(user.id);
    if (!identity?.sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sign-in failed. Please sign in normally.' },
        { status: 500 }
      );
    }

    const session = await db.session.findUnique({
      where: { id: identity.sessionId },
    });
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

    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/verify-email-by-code — redeem a code-based verification link.
 *
 * Same logic as the token-based flow, but using a 6-digit code instead of a token.
 */
export async function POST_by_code(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Verification code is required.' },
        { status: 400 }
      );
    }

    const record = await findVerificationRecord(code);
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'This verification code is invalid or has expired.' },
        { status: 400 }
      );
    }

    const consumed = await consumeVerificationRecord(code);
    if (!consumed) {
      return NextResponse.json(
        { success: false, error: 'This verification code has already been used.' },
        { status: 409 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: record.record.userId },
      include: { profile: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'This verification code is invalid or has expired.' },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });

    const identity = await authProvider.issueSession(user.id);
    if (!identity?.sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sign-in failed. Please sign in normally.' },
        { status: 500 }
      );
    }

    const session = await db.session.findUnique({
      where: { id: identity.sessionId },
    });
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

    return response;
  } catch (error) {
    console.error('Email verification by code error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
