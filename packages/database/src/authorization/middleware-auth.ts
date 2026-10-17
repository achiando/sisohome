/**
 * Next.js Middleware for Auth Context Injection
 * Injects auth context into requests for server-side and client-side use
 * Note: This file requires Next.js as a peer dependency
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationService, SessionAuthorizationCache } from '..';

// ============================================================================
// AUTH MIDDLEWARE CONFIG
// ============================================================================

export interface AuthMiddlewareConfig {
  authService: AuthenticationService;
  sessionCache?: SessionAuthorizationCache;
  protectedPaths?: string[];
  publicPaths?: string[];
  apiAuthPath?: string;
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const {
    authService,
    sessionCache = new SessionAuthorizationCache(),
    protectedPaths = ['/', '/people', '/roles', '/settings', '/admin'],
    publicPaths = ['/login', '/register', '/api/auth/login'],
    apiAuthPath = '/api/auth',
  } = config;

  return async function authMiddleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for public paths
    if (publicPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Skip middleware for auth API endpoints
    if (pathname.startsWith(apiAuthPath)) {
      return NextResponse.next();
    }

    try {
      // Get session token from cookie
      const sessionToken = request.cookies.get('session')?.value;

      if (!sessionToken) {
        // Redirect to login for protected paths
        if (protectedPaths.some(path => pathname.startsWith(path))) {
          return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
      }

      // Verify session
      const identity = await authService.verifySession(sessionToken);

      // Check session cache for permissions
      const sessionEntry = await sessionCache.getOrCreateSession(
        identity.userId,
        null // Global context
      );

      // Create response with auth headers
      const response = NextResponse.next();

      // Inject auth context into headers for server components
      response.headers.set('x-user-id', identity.userId);
      response.headers.set('x-authenticated', 'true');

      // Inject permissions if cached
      if (sessionEntry) {
        response.headers.set('x-has-permissions', 'true');
        response.headers.set(
          'x-permissions',
          JSON.stringify(sessionEntry.permissions)
        );
        response.headers.set('x-roles', JSON.stringify(sessionEntry.roles));
      }

      // Inject organization ID if present
      const orgId = request.cookies.get('active-organization')?.value;
      if (orgId) {
        response.headers.set('x-organization-id', orgId);
      }

      return response;
    } catch (error) {
      console.error('Auth middleware error:', error);

      // Clear invalid session
      const response = NextResponse.next();
      response.cookies.delete('session');

      // Redirect to login for protected paths
      if (protectedPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      return response;
    }
  };
}

// ============================================================================
// SERVER COMPONENT HELPER
// ============================================================================

export interface ServerAuthContext {
  userId: string;
  organizationId: string | null;
  isAuthenticated: boolean;
}

/**
 * Extract auth context from headers in server components
 * Call this in server components to get auth context
 */
export function getServerAuthContext(): ServerAuthContext {
  if (typeof window !== 'undefined') {
    // Client-side - should use React hooks instead
    throw new Error('getServerAuthContext can only be used in server components');
  }

  // In Next.js server components, we'd need to use headers()
  // This is a placeholder - actual implementation depends on Next.js version
  const headers: any = {}; // Would be: headers()

  return {
    userId: headers.get('x-user-id') || '',
    organizationId: headers.get('x-organization-id') || null,
    isAuthenticated: headers.get('x-authenticated') === 'true',
  };
}

/**
 * Get permissions from headers in server components
 */
export function getServerPermissions(): string[] {
  if (typeof window !== 'undefined') {
    throw new Error('getServerPermissions can only be used in server components');
  }

  const headers: any = {}; // Would be: headers()
  const permissionsHeader = headers.get('x-permissions');

  if (!permissionsHeader) return [];

  try {
    return JSON.parse(permissionsHeader);
  } catch {
    return [];
  }
}

/**
 * Get roles from headers in server components
 */
export function getServerRoles(): string[] {
  if (typeof window !== 'undefined') {
    throw new Error('getServerRoles can only be used in server components');
  }

  const headers: any = {}; // Would be: headers()
  const rolesHeader = headers.get('x-roles');

  if (!rolesHeader) return [];

  try {
    return JSON.parse(rolesHeader);
  } catch {
    return [];
  }
}
