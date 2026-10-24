/**
 * Next 16 Proxy (formerly middleware) — OPTIMISTIC routing only.
 *
 * Cookie presence checks for redirects between /login, /onboarding and the
 * app shell. This is NOT authorization: every protected API route and server
 * layout still enforces real checks via `protectRoute` / server permission
 * lookups against the database.
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'siso_session';
const ACTIVE_ORG_COOKIE = 'siso_active_org';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  // Legal documents linked from the signup consent checkbox — must be
  // readable before a session exists.
  '/terms',
  '/privacy',
  // Public applicant intake (/i/<token>) — capability lives in the token.
  '/i',
];
const PUBLIC_API_PATHS = ['/api/auth', '/api/intake'];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept static assets or Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') // files: favicon.ico, theme assets, etc.
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const hasActiveOrg = Boolean(request.cookies.get(ACTIVE_ORG_COOKIE)?.value);
  const onOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/');
  const onAuthPage = isPublicPage(pathname);
  // Forced-password-change screen must be reachable before an org cookie
  // exists (and while signed out the page itself redirects to login).
  const onPasswordChange =
    pathname === '/change-password' || pathname.startsWith('/change-password/');
  // Shared create-organization page: reachable from onboarding (no org cookie
  // yet) and from the dashboard (org cookie present — falls through below).
  const onCreateOrg =
    pathname === '/create-organization' || pathname.startsWith('/create-organization/');

  // Not signed in
  if (!hasSession) {
    if (isPublicApi(pathname)) {
      return NextResponse.next(); // auth endpoints must be reachable
    }
    if (onAuthPage || onPasswordChange) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but no active organization → onboarding
  if (!hasActiveOrg && !onOnboarding) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      // APIs that create/join orgs must stay reachable during onboarding
      return NextResponse.next();
    }
    if (onAuthPage || onPasswordChange || onCreateOrg) {
      // Auth pages / forced password change / shared create page are
      // reachable before an active org exists.
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Signed in with an active org — visiting onboarding is allowed (add
  // another org later). Auth pages (/login, /signup, …) simply fall through:
  // cookie presence cannot prove an UNEXPIRED session, so bouncing away here
  // loops forever (/ ↔ /login) when the session row has expired. The login
  // screen redirects real sessions client-side after the real session check.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
