/**
 * Route-Level Permission Guards
 * Easy-to-use constructors for protecting routes
 */

import { AuthorizationService } from './authorization.service';
import { TenantService } from '../tenancy/tenant.service';
import { UnauthenticatedError } from '../authentication/types';
import { TenantRequiredError } from '../tenancy/types';
import { AuthContext } from '../authentication/types';
import { PermissionKey, PermissionDeniedException } from './types';

// ============================================================================
// PERMISSION GUARD BUILDER
// ============================================================================

export class PermissionGuard {
  private authService: AuthorizationService;
  private tenantService: TenantService;
  private authContext: AuthContext | null = null;
  private requiredPermissions: PermissionKey[] = [];
  private requireTenant = false;

  constructor(
    authService: AuthorizationService,
    tenantService: TenantService
  ) {
    this.authService = authService;
    this.tenantService = tenantService;
  }

  /**
   * Set the authentication context
   * @param context - Auth context from request
   */
  withContext(context: AuthContext): this {
    this.authContext = context;
    return this;
  }

  /**
   * Require specific permission
   * @param permission - Permission key required
   */
  requirePermission(permission: PermissionKey): this {
    this.requiredPermissions.push(permission);
    return this;
  }

  /**
   * Require multiple permissions (all must be present)
   * @param permissions - Array of permission keys
   */
  requirePermissions(permissions: PermissionKey[]): this {
    this.requiredPermissions.push(...permissions);
    return this;
  }

  /**
   * Require tenant context
   */
  requireOrganization(): this {
    this.requireTenant = true;
    return this;
  }

  /**
   * Check if guard conditions are met
   * @returns true if authorized
   * @throws UnauthenticatedError if not authenticated
   * @throws TenantRequiredError if tenant required but not provided
   * @throws PermissionDeniedError if permissions not granted
   */
  async check(): Promise<boolean> {
    if (!this.authContext) {
      throw new UnauthenticatedError('Authentication context required');
    }

    // Check tenant requirement
    if (this.requireTenant) {
      this.tenantService.requireTenant(this.authContext.organizationId);
      if (this.authContext.organizationId) {
        await this.tenantService.validateMembership(
          this.authContext.userId,
          this.authContext.organizationId
        );
      }
    }

    // Check permissions
    for (const permission of this.requiredPermissions) {
      const hasPermission = await this.authService.checkPermission(
        this.authContext.userId,
        permission,
        this.authContext.organizationId || undefined
      );

      if (!hasPermission) {
        throw new PermissionDeniedException(permission, {
          userId: this.authContext.userId,
          organizationId: this.authContext.organizationId,
        });
      }
    }

    return true;
  }

  /**
   * Check and throw if not authorized
   */
  async assert(): Promise<void> {
    await this.check();
  }
}

// ============================================================================
// GUARD FACTORY
// ============================================================================

export function createPermissionGuard(
  authService: AuthorizationService,
  tenantService: TenantService
): PermissionGuard {
  return new PermissionGuard(authService, tenantService);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick permission check
 * @param authService - Authorization service
 * @param context - Auth context
 * @param permission - Permission to check
 * @returns true if authorized
 */
export async function hasPermission(
  authService: AuthorizationService,
  context: AuthContext,
  permission: PermissionKey
): Promise<boolean> {
  return authService.checkPermission(
    context.userId,
    permission,
    context.organizationId || undefined
  );
}

/**
 * Require permission (throws if not authorized)
 * @param authService - Authorization service
 * @param context - Auth context
 * @param permission - Permission to require
 * @throws PermissionDeniedException if not authorized
 */
export async function requirePermission(
  authService: AuthorizationService,
  context: AuthContext,
  permission: PermissionKey
): Promise<void> {
  const has = await hasPermission(authService, context, permission);
  if (!has) {
    throw new PermissionDeniedException(permission, {
      userId: context.userId,
      organizationId: context.organizationId,
    });
  }
}

/**
 * Require tenant membership (throws if not member)
 * @param tenantService - Tenant service
 * @param context - Auth context
 * @throws TenantRequiredError if no tenant context
 * @throws MembershipRequiredError if not a member
 */
export async function requireTenantMembership(
  tenantService: TenantService,
  context: AuthContext
): Promise<void> {
  tenantService.requireTenant(context.organizationId);
  if (context.organizationId) {
    await tenantService.validateMembership(
      context.userId,
      context.organizationId
    );
  }
}

/**
 * UI helper: check if user's permissions grant an action (for conditionally rendering buttons/elements)
 */
export function hasUiPermission(
  permissions?: string[] | null,
  requiredPermission?: string | null
): boolean {
  if (!permissions || !requiredPermission) return false;
  return permissions.includes(requiredPermission) || permissions.includes('platform.admin');
}

/**
 * UI helper: check if user has a role (for conditionally rendering UI panels)
 */
export function hasUiRole(
  roles?: string[] | null,
  requiredRole?: string | null
): boolean {
  if (!roles || !requiredRole) return false;
  return roles.includes(requiredRole);
}
