/**
 * Session cookie helpers
 * The session token lives ONLY in an httpOnly cookie — never in JS-readable
 * storage or a JSON response body. The client reads auth state from
 * GET /api/auth/session, which reads this cookie server-side.
 */

import { NextResponse } from 'next/server';
import { PENDING_COOKIE, PENDING_TTL_MS } from './two-factor';

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

/**
 * Pending-2FA cookie: set once the password check passes for an account with
 * 2FA enabled, cleared when the second factor is proven (or on failure).
 * It grants nothing on its own — only /api/auth/2fa/verify reads it, and it
 * carries an HMAC signature + expiry issued in lib/two-factor.ts.
 */
const PENDING_TWO_FACTOR_COOKIE = PENDING_COOKIE;
const PENDING_TWO_FACTOR_TTL_SECONDS = Math.floor(PENDING_TTL_MS / 1000);

export function setTwoFactorPendingCookie(response: NextResponse, token: string): void {
  response.cookies.set(PENDING_TWO_FACTOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PENDING_TWO_FACTOR_TTL_SECONDS,
  });
}

export function clearTwoFactorPendingCookie(response: NextResponse): void {
  response.cookies.set(PENDING_TWO_FACTOR_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
