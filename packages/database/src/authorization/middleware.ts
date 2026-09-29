/**
 * Authorization Middleware and Decorators
 * Reusable authorization utilities for routes and actions
 */

import { AuthorizationService } from './authorization.service';
import {
  AuthorizationRequest,
  AuthorizationResult,
  PermissionKey,
  ResourceType,
  AuthorizationException,
  PermissionDeniedException,
  MembershipRequiredException,
  OrganizationAccessException,
  AuthorizationMiddlewareOptions,
  AuthenticatedRequest,
} from './types';

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

export function createAuthorizationMiddleware(authService: AuthorizationService) {
  return {
    /**
     * Express/Next.js middleware for route-level authorization
     */
    authorize: (options: AuthorizationMiddlewareOptions) => {
      return async (req: any, res: any, next: any) => {
        try {
          const authRequest = this.buildRequestFromContext(req, options);
          const result = await authService.authorize(authRequest);

          if (!result.authorized) {
            return this.handleUnauthorized(res, result);
          }

          // Attach authorization context to request
          req.authorization = result;
          next();
        } catch (error) {
          console.error('Authorization middleware error:', error);
          return res.status(500).json({
            error: 'Authorization error',
            message: 'An error occurred during authorization',
          });
        }
      };
    },

    /**
     * Higher-order function for API route handlers
     */
    withAuthorization: <T extends any[]>(
      handler: (req: AuthenticatedRequest, ...args: T) => Promise<any>,
      options: AuthorizationMiddlewareOptions
    ) => {
      return async (req: any, ...args: T) => {
        try {
          const authRequest = this.buildRequestFromContext(req, options);
          const result = await authService.authorize(authRequest);

          if (!result.authorized) {
            return this.handleUnauthorizedResponse(result);
          }

          // Call the original handler with authorization context
          return await handler(
            {
              ...req,
              authorization: result,
            },
            ...args
          );
        } catch (error) {
          console.error('Authorization wrapper error:', error);
          return {
            error: 'Authorization error',
            message: 'An error occurred during authorization',
          };
        }
      };
    },

    /**
     * Check if user has specific permission (returns boolean)
     */
    hasPermission: (permission: PermissionKey, organizationId?: string) => {
      return async (req: any, res: any, next: any) => {
        try {
          const userId = req.user?.id || req.userId;
          if (!userId) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'User not authenticated',
            });
          }

          const hasPermission = await authService.checkPermission(
            userId,
            permission,
            organizationId
          );

          if (!hasPermission) {
            return res.status(403).json({
              error: 'Forbidden',
              message: `Permission required: ${permission}`,
            });
          }

          next();
        } catch (error) {
          console.error('Permission check error:', error);
          return res.status(500).json({
            error: 'Authorization error',
            message: 'An error occurred during permission check',
          });
        }
      };
    },

    /**
     * Require organization membership
     */
    requireOrganization: () => {
      return async (req: any, res: any, next: any) => {
        try {
          const userId = req.user?.id || req.userId;
          const organizationId = req.params.organizationId || req.body.organizationId || req.headers['x-organization-id'];

          if (!userId || !organizationId) {
            return res.status(400).json({
              error: 'Bad request',
              message: 'User ID and Organization ID are required',
            });
          }

          const hasAccess = await authService.canUserAccessOrganization(userId, organizationId);

          if (!hasAccess) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'You do not have access to this organization',
            });
          }

          next();
        } catch (error) {
          console.error('Organization check error:', error);
          return res.status(500).json({
            error: 'Authorization error',
            message: 'An error occurred during organization check',
          });
        }
      };
    },

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    buildRequestFromContext(req: any, options: AuthorizationMiddlewareOptions): AuthorizationRequest {
      const userId = req.user?.id || req.userId;
      const organizationId = 
        req.params[options.organizationParam || 'organizationId'] ||
        req.body.organizationId ||
        req.headers['x-organization-id'] ||
        req.query.organizationId;

      const resourceId = options.resourceParam ? req.params[options.resourceParam] : undefined;

      return {
        userId,
        permission: options.permission,
        resourceType: options.resourceType,
        resourceId,
        organizationId,
        context: {
          ipAddress: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
        },
      };
    },

    handleUnauthorized(res: any, result: AuthorizationResult) {
      return res.status(403).json({
        error: 'Forbidden',
        message: result.reason || 'Access denied',
        code: result.error,
      });
    },

    handleUnauthorizedResponse(result: AuthorizationResult) {
      return {
        error: 'Forbidden',
        message: result.reason || 'Access denied',
        code: result.error,
        status: 403,
      };
    },
  };
}

// ============================================================================
// DECORATORS (for TypeScript class-based controllers)
// ============================================================================

export function Authorize(permission: PermissionKey, options?: Partial<AuthorizationMiddlewareOptions>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // In a real implementation, you'd need to access the authService
      // This is a placeholder showing the pattern
      console.log(`Checking permission: ${permission} for method: ${propertyKey}`);
      
      // The actual authorization check would happen here
      // For now, we'll just call the original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export function RequireOrganization() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      console.log(`Requiring organization for method: ${propertyKey}`);
      
      // The actual organization check would happen here
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ============================================================================
// REUSABLE AUTHORIZATION HELPERS
// ============================================================================

export class AuthorizationHelper {
  constructor(private authService: AuthorizationService) {}

  /**
   * Check if user can perform action on resource
   */
  async can(
    userId: string,
    permission: PermissionKey,
    resourceType?: ResourceType,
    resourceId?: string,
    organizationId?: string
  ): Promise<boolean> {
    const result = await this.authService.authorize({
      userId,
      permission,
      resourceType,
      resourceId,
      organizationId,
    });
    return result.authorized;
  }

  /**
   * Assert user can perform action, throw exception if not
   */
  async assertCan(
    userId: string,
    permission: PermissionKey,
    resourceType?: ResourceType,
    resourceId?: string,
    organizationId?: string
  ): Promise<void> {
    const result = await this.authService.authorize({
      userId,
      permission,
      resourceType,
      resourceId,
      organizationId,
    });

    if (!result.authorized) {
      throw new PermissionDeniedException(permission, {
        userId,
        resourceType,
        resourceId,
        organizationId,
        reason: result.reason,
      });
    }
  }

  /**
   * Assert user has organization membership
   */
  async assertOrganizationMembership(userId: string, organizationId: string): Promise<void> {
    const hasAccess = await this.authService.canUserAccessOrganization(userId, organizationId);
    
    if (!hasAccess) {
      throw new MembershipRequiredException(organizationId, { userId });
    }
  }

  /**
   * Get user's permissions for a specific context
   */
  async getPermissions(userId: string, organizationId?: string): Promise<PermissionKey[]> {
    return this.authService.getUserPermissions(userId, organizationId);
  }

  /**
   * Get user's roles for a specific context
   */
  async getRoles(userId: string, organizationId?: string) {
    return this.authService.getUserRoles(userId, organizationId);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(
    userId: string,
    permissions: PermissionKey[],
    organizationId?: string
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(userId, organizationId);
    return permissions.some(permission => userPermissions.includes(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(
    userId: string,
    permissions: PermissionKey[],
    organizationId?: string
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(userId, organizationId);
    return permissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Check if user has any of the specified roles
   */
  async hasAnyRole(userId: string, roleSlugs: string[], organizationId?: string): Promise<boolean> {
    const roles = await this.getRoles(userId, organizationId);
    const userRoleSlugs = roles.map(r => r.slug);
    return roleSlugs.some(slug => userRoleSlugs.includes(slug));
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userId: string, roleSlug: string, organizationId?: string): Promise<boolean> {
    return this.hasAnyRole(userId, [roleSlug], organizationId);
  }

  /**
   * Get user's accessible organizations
   */
  async getAccessibleOrganizations(userId: string): Promise<string[]> {
    return this.authService.getUserOrganizations(userId);
  }

  /**
   * Switch organization context
   */
  async switchOrganization(userId: string, newOrganizationId: string): Promise<boolean> {
    const hasAccess = await this.authService.canUserAccessOrganization(userId, newOrganizationId);
    
    if (hasAccess) {
      // Clear cache for the user to ensure fresh permissions
      await this.authService.clearCache(userId);
      await this.authService.warmCache(userId, newOrganizationId);
      return true;
    }
    
    return false;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a reusable permission checker function
 */
export function createPermissionChecker(authService: AuthorizationService) {
  return {
    /**
     * Check if current user has permission
     */
    check: async (permission: PermissionKey, context?: { userId?: string; organizationId?: string }) => {
      const userId = context?.userId;
      if (!userId) {
        throw new Error('User ID is required for permission check');
      }
      return authService.checkPermission(userId, permission, context?.organizationId);
    },

    /**
     * Check if current user can access resource
     */
    canAccess: async (
      resourceType: ResourceType,
      resourceId: string,
      permission: PermissionKey,
      context?: { userId?: string; organizationId?: string }
    ) => {
      const userId = context?.userId;
      if (!userId) {
        throw new Error('User ID is required for resource access check');
      }
      return authService.canAccessResource(
        userId,
        resourceType,
        resourceId,
        permission,
        context?.organizationId
      );
    },

    /**
     * Get current user's permissions
     */
    getPermissions: async (context?: { userId?: string; organizationId?: string }) => {
      const userId = context?.userId;
      if (!userId) {
        throw new Error('User ID is required to get permissions');
      }
      return authService.getUserPermissions(userId, context?.organizationId);
    },
  };
}
