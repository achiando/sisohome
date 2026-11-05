import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/auth';
import { authProvider, authorizationService } from '@/lib/auth';
import { setActiveOrgCookie, setSessionCookie } from '@/lib/session-cookie';
import {
  findVerificationRecord,
  consumeVerificationRecord,
} from '@/lib/verify-email';

/**
 * POST /api/auth/verify-email-by-code — redeem a code-based verification link.
 *
 * Same logic as the token-based flow, but using a 6-digit code instead of a token.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
