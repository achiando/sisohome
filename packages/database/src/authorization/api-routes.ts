/**
 * Next.js API Route Helpers
 * Server-side auth context providers for Next.js routes
 * Note: This file requires Next.js as a peer dependency
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthorizationService, TenantService, AuthenticationService } from '..';
import { AuthContext } from '../authentication/types';

// ============================================================================
// AUTH CONTEXT EXTRACTION
// ============================================================================

export interface AuthContextFromRequestOptions {
  authService: AuthorizationService;
  tenantService: TenantService;
  request: NextRequest;
}

/**
 * Extract auth context from Next.js request
 * Assumes authentication middleware has already run and set headers/cookies
 */
export async function getAuthContextFromRequest(
  options: AuthContextFromRequestOptions
): Promise<AuthContext> {
  const { request } = options;

  // Extract from headers (set by auth middleware)
  const userId = request.headers.get('x-user-id');
  const authUserId = request.headers.get('x-auth-user-id');
  const organizationId = request.headers.get('x-organization-id');

  if (!userId || !authUserId) {
    throw new Error('Authentication context not found in request');
  }

  return {
    userId,
    authUserId,
    organizationId: organizationId || null,
  };
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export interface CreateAuthApiRouteOptions {
  authService: AuthorizationService;
  tenantService: TenantService;
  authenticationService?: AuthenticationService;
}

/**
 * Create auth API route handlers
 * Returns handlers for session, permissions, and organization switching
 */
export function createAuthApiRoutes(options: CreateAuthApiRouteOptions) {
  const { authService, tenantService } = options;

  return {
    /**
     * GET /api/auth/session
     * Returns current user's auth context, permissions, and roles
     */
    async getSession(request: NextRequest) {
      try {
        const authContext = await getAuthContextFromRequest({
          authService,
          tenantService,
          request,
        });

        const permissions = await authService.getUserPermissions(
          authContext.userId,
          authContext.organizationId || undefined
        );

        const roles = await authService.getUserRoles(
          authContext.userId,
          authContext.organizationId || undefined
        );

        return NextResponse.json({
          userId: authContext.userId,
          authUserId: authContext.authUserId,
          organizationId: authContext.organizationId,
          permissions,
          roles: roles.map(r => r.slug),
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to get session' },
          { status: 401 }
        );
      }
    },

    /**
     * POST /api/auth/switch-organization
     * Switch active organization context
     */
    async switchOrganization(request: NextRequest) {
      try {
        const body = await request.json();
        const { organizationId } = body;

        const authContext = await getAuthContextFromRequest({
          authService,
          tenantService,
          request,
        });

        // Validate user can access organization
        const canAccess = await tenantService.canUserAccessOrganization(
          authContext.userId,
          organizationId
        );

        if (!canAccess) {
          return NextResponse.json(
            { error: 'Cannot access organization' },
            { status: 403 }
          );
        }

        // Get permissions for new organization
        const permissions = await authService.getUserPermissions(
          authContext.userId,
          organizationId
        );

        const roles = await authService.getUserRoles(
          authContext.userId,
          organizationId
        );

        return NextResponse.json({
          organizationId,
          permissions,
          roles: roles.map(r => r.slug),
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to switch organization' },
          { status: 400 }
        );
      }
    },

    /**
     * GET /api/auth/permissions
     * Returns user's permissions for current organization
     */
    async getPermissions(request: NextRequest) {
      try {
        const authContext = await getAuthContextFromRequest({
          authService,
          tenantService,
          request,
        });

        const permissions = await authService.getUserPermissions(
          authContext.userId,
          authContext.organizationId || undefined
        );

        return NextResponse.json({ permissions });
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to get permissions' },
          { status: 401 }
        );
      }
    },
  };
}

// ============================================================================
// ROUTE GUARD HELPER
// ============================================================================

export interface ProtectedRouteOptions {
  authService: AuthorizationService;
  tenantService: TenantService;
  requiredPermissions?: string[];
  requireOrganization?: boolean;
}

/**
 * Protect a Next.js API route with authorization
 * Usage in route handler:
 * 
 * export async function GET(request: NextRequest) {
 *   const authContext = await protectRoute({
 *     authService,
 *     tenantService,
 *     requiredPermissions: ['customers.read'],
 *   })(request);
 *   
 *   // Proceed with business logic
 * }
 */
export function protectRoute(options: ProtectedRouteOptions) {
  return async (request: NextRequest): Promise<AuthContext> => {
    const { authService, tenantService, requiredPermissions, requireOrganization } =
      options;

    // Get auth context
    const authContext = await getAuthContextFromRequest({
      authService,
      tenantService,
      request,
    });

    // Require organization if specified
    if (requireOrganization && !authContext.organizationId) {
      throw new Error('Organization context required');
    }

    // Check permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      for (const permission of requiredPermissions) {
        const hasPermission = await authService.checkPermission(
          authContext.userId,
          permission as any,
          authContext.organizationId || undefined
        );

        if (!hasPermission) {
          throw new Error(`Permission denied: ${permission}`);
        }
      }
    }

    return authContext;
  };
}
