/**
 * Session cookie helpers
 * The session token lives ONLY in an httpOnly cookie — never in JS-readable
 * storage or a JSON response body. The client reads auth state from
 * GET /api/auth/session, which reads this cookie server-side.
 */

import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'siso_session';
/** Active organization context cookie — readable by proxy for optimistic routing. */
export const ACTIVE_ORG_COOKIE = 'siso_active_org';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Active-organization cookie. Non-httpOnly on purpose: proxy.ts reads it for
 * optimistic redirects only (never for authorization — protectRoute is the
 * real gate).
 */
export function setActiveOrgCookie(response: NextResponse, organizationId: string | null): void {
  if (organizationId) {
    response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_SECONDS,
    });
  } else {
    response.cookies.set(ACTIVE_ORG_COOKIE, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
