import { NextRequest, NextResponse } from 'next/server';
import { authProvider, db } from '@/lib/auth';
import { setSessionCookie, setActiveOrgCookie } from '@/lib/session-cookie';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Sign up using password provider
    const identity = await authProvider.signUp(email, password, name);

    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Get user details
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

    const session = await db.session.findUnique({
      where: { id: identity.sessionId },
    });

    // Signup creates the account only — no org, no roles, no permissions.
    // The client should redirect to /onboarding to create or join an org.
    const response = NextResponse.json({
      success: true,
      onboardingRequired: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        avatar: user.profile?.avatarUrl,
      },
      session: {
        expiresAt: session?.expiresAt?.toISOString(),
        organizationId: null,
        permissions: [],
        roles: [],
      },
    });

    // Persist session token in httpOnly cookie; no active org yet (onboarding).
    if (session?.token) {
      setSessionCookie(response, session.token);
      setActiveOrgCookie(response, null);
    }

    return response;
  } catch (error) {
    console.error('Sign up error:', error);
    return NextResponse.json(
      { success: false, error: 'Sign up failed' },
      { status: 500 }
    );
  }
}
