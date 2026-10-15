/**
 * Enterprise-Scale Authorization Service
 * Domain-agnostic, reusable authorization layer
 */

import { PrismaClient } from '../prisma';
import {
  IAuthorizationService,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationReason,
  AuthorizationError,
  PermissionKey,
  PermissionScope,
  ResourceType,
  RelationshipType,
  Role,
  Permission,
  ResourceRelationship,
  CacheConfig,
  CacheEntry,
  AuthorizationException,
  PermissionDeniedException,
  MembershipRequiredException,
  OrganizationAccessException,
} from './types';
import { SessionAuthorizationCache } from './session-cache';
import { PolicyEngine } from './policy-engine';
import { AuditService } from '../audit';
import { AuthContext } from '../authentication/types';

export class AuthorizationService implements IAuthorizationService {
  private prisma: PrismaClient;
  private cache: Map<string, CacheEntry> = new Map();
  private sessionCache: SessionAuthorizationCache;
  private policyEngine: PolicyEngine;
  private auditService: AuditService;
  private cacheConfig: CacheConfig = {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000,
    strategy: 'memory',
  };

  constructor(
    prisma: PrismaClient,
    cacheConfig?: Partial<CacheConfig>,
    sessionCache?: SessionAuthorizationCache,
    policyEngine?: PolicyEngine,
    auditService?: AuditService
  ) {
    this.prisma = prisma;
    if (cacheConfig) {
      this.cacheConfig = { ...this.cacheConfig, ...cacheConfig };
    }
    this.sessionCache = sessionCache || new SessionAuthorizationCache(this.cacheConfig.ttl);
    this.policyEngine = policyEngine || new PolicyEngine();
    this.auditService = auditService || new AuditService(prisma);
  }

  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  getAuditService(): AuditService {
    return this.auditService;
  }

  /**
   * Simple developer API: check if user/tenant has permission and passes resource policy
   */
  async can(
    ctx: AuthContext,
    permission: PermissionKey,
    resource?: { id?: string; type?: string; organizationId?: string | null; [key: string]: any }
  ): Promise<boolean> {
    if (resource?.organizationId && ctx.organizationId && resource.organizationId !== ctx.organizationId) {
      return false;
    }

    const decision = await this.authorize({
      userId: ctx.userId,
      permission,
      organizationId: ctx.organizationId || undefined,
      resourceId: resource?.id,
      resourceType: (resource?.type as ResourceType) || undefined,
    });

    if (!decision.authorized) return false;

    if (resource && resource.type && this.policyEngine.getPolicy(resource.type)) {
      const action = permission.includes('.') ? permission.split('.')[1] : permission;
      const allowedByPolicy = await this.policyEngine.can(resource.type, action || permission, ctx, resource);
      if (!allowedByPolicy) return false;
    }

    return true;
  }

  /**
   * Simple developer API: require permission and resource policy (throws on deny)
   */
  async require(
    ctx: AuthContext,
    permission: PermissionKey,
    resource?: { id?: string; type?: string; organizationId?: string | null; [key: string]: any }
  ): Promise<void> {
    const allowed = await this.can(ctx, permission, resource);
    if (!allowed) {
      throw new PermissionDeniedException(permission, {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resourceId: resource?.id,
      });
    }
  }

  // ============================================================================
  // CORE AUTHORIZATION
  // ============================================================================

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    try {
      // 1. Validate authentication
      if (!request.userId) {
        return this.deniedResult(AuthorizationReason.UNAUTHENTICATED);
      }

      // 2. Check user existence and status
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        include: { profile: true },
      });

      if (!user) {
        return this.deniedResult(AuthorizationReason.USER_NOT_FOUND, AuthorizationError.USER_NOT_FOUND);
      }

      if (user.status !== 'ACTIVE') {
        return this.deniedResult(AuthorizationReason.USER_INACTIVE, AuthorizationError.USER_INACTIVE);
      }

      // 3. If organization context, validate organization
      if (request.organizationId) {
        const orgResult = await this.validateOrganizationAccess(
          request.userId,
          request.organizationId
        );
        if (!orgResult.authorized) {
          return orgResult;
        }
      }

      // 4. Check session cache for permissions
      const sessionEntry = await this.sessionCache.getOrCreateSession(
        request.userId,
        request.organizationId || null
      );

      // 5. Check cache for existing authorization
      const cacheKey = this.buildCacheKey(request);
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.value?.authorized !== undefined) {
        return cached.value as AuthorizationResult;
      }

      // 5. Check permission
      const hasPermission = await this.checkPermission(
        request.userId,
        request.permission,
        request.organizationId
      );

      if (!hasPermission) {
        const result = this.deniedResult(
          AuthorizationReason.INSUFFICIENT_PERMISSIONS,
          AuthorizationError.INSUFFICIENT_PERMISSIONS
        );
        await this.logAuthorizationAttempt(request, result);
        return result;
      }

      // 6. If resource access, check resource authorization
      if (request.resourceType && request.resourceId) {
        const resourceResult = await this.authorizeResourceAccess(request);
        if (!resourceResult.authorized) {
          await this.logAuthorizationAttempt(request, resourceResult);
          return resourceResult;
        }
      }

      // 7. Authorization successful
      const result = await this.buildAuthorizedResult(request);
      this.setCache(cacheKey, result);
      await this.logAuthorizationAttempt(request, result);
      return result;

    } catch (error) {
      console.error('Authorization error:', error);
      const result = this.deniedResult(
        AuthorizationReason.SYSTEM_ERROR,
        AuthorizationError.AUTHORIZATION_SERVICE_ERROR
      );
      await this.logAuthorizationAttempt(request, result);
      return result;
    }
  }

  async checkPermission(
    userId: string,
    permission: PermissionKey,
    organizationId?: string
  ): Promise<boolean> {
    try {
      // Get user's roles in the organization (or global roles)
      const roles = await this.getUserRoles(userId, organizationId);
      
      // Get all permissions for these roles
      const roleIds = roles.map(r => r.id);
      const permissions = await this.prisma.rolePermission.findMany({
        where: { roleId: { in: roleIds } },
        include: { permission: true },
      });

      // Check if the requested permission exists
      return permissions.some((rp: any) => rp.permission.key === permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // ============================================================================
  // USER AUTHORIZATION
  // ============================================================================

  async getUserPermissions(userId: string, organizationId?: string): Promise<PermissionKey[]> {
    // Check session cache first
    const sessionEntry = await this.sessionCache.getOrCreateSession(userId, organizationId || null);
    if (sessionEntry && sessionEntry.permissions.length > 0) {
      return sessionEntry.permissions as PermissionKey[];
    }

    const cacheKey = `user_permissions:${userId}:${organizationId || 'global'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached.value as PermissionKey[];

    const roles = await this.getUserRoles(userId, organizationId);
    const roleIds = roles.map(r => r.id);

    const permissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });

    const permissionKeys = permissions.map((rp: any) => rp.permission.key as PermissionKey);
    this.setCache(cacheKey, permissionKeys);
    
    // Update session cache
    if (organizationId) {
      await this.sessionCache.updateSession(
        userId,
        organizationId,
        { userId, authUserId: '', organizationId },
        permissionKeys,
        roles.map(r => r.slug)
      );
    }
    
    return permissionKeys;
  }

  async getUserRoles(userId: string, organizationId?: string): Promise<Role[]> {
    const cacheKey = `user_roles:${userId}:${organizationId || 'global'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached.value as Role[];

    // Get user's organization memberships
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(organizationId && { organizationId }),
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    // Combine roles - only organization-specific roles
    const userRoles: Role[] = [];

    // Add organization-specific roles
    for (const membership of memberships) {
      for (const memberRole of membership.roles) {
        const role = memberRole.role;
        userRoles.push({
          id: role.id,
          organizationId: role.organizationId ?? undefined,
          name: role.name,
          slug: role.slug,
          description: role.description ?? undefined,
          isSystem: role.isSystem,
          permissions: role.permissions.map((rp: any) => ({
            id: rp.permission.id,
            key: rp.permission.key as PermissionKey,
            name: rp.permission.name,
            description: rp.permission.description ?? undefined,
            scope: (rp.permission.scope as PermissionScope) || PermissionScope.ORGANIZATION,
          })),
        });
      }
    }

    this.setCache(cacheKey, userRoles);
    return userRoles;
  }

  // ============================================================================
  // RESOURCE AUTHORIZATION
  // ============================================================================

  async canAccessResource(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: PermissionKey,
    organizationId?: string
  ): Promise<AuthorizationResult> {
    return this.authorize({
      userId,
      permission,
      resourceType,
      resourceId,
      organizationId,
    });
  }

  async hasRelationship(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    relationship: RelationshipType,
    organizationId?: string
  ): Promise<boolean> {
    try {
      const relationships = await this.prisma.resourceRelationship.findMany({
        where: {
          subjectType: 'User',
          subjectId: userId,
          resourceType,
          resourceId,
          relationship,
          ...(organizationId && { organizationId }),
        },
      });

      // Check if any relationship is currently valid
      const now = new Date();
      return relationships.some((rel: any) => {
        if (rel.startsAt && rel.startsAt > now) return false;
        if (rel.endsAt && rel.endsAt < now) return false;
        return true;
      });
    } catch (error) {
      console.error('Error checking relationship:', error);
      return false;
    }
  }

  // ============================================================================
  // ORGANIZATION AUTHORIZATION
  // ============================================================================

  async canUserAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
    const result = await this.validateOrganizationAccess(userId, organizationId);
    return result.authorized;
  }

  async getUserOrganizations(userId: string): Promise<string[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { organizationId: true },
    });

    return memberships.map((m: any) => m.organizationId);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  async clearCache(userId?: string, organizationId?: string): Promise<void> {
    if (!userId && !organizationId) {
      this.cache.clear();
      return;
    }

    const prefix = userId ? `user_permissions:${userId}` : '';
    const orgSuffix = organizationId ? `:${organizationId}` : '';

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix) && key.endsWith(orgSuffix)) {
        this.cache.delete(key);
      }
    }
  }

  async warmCache(userId: string, organizationId?: string): Promise<void> {
    await this.getUserPermissions(userId, organizationId);
    await this.getUserRoles(userId, organizationId);
  }

  // ============================================================================
  // AUDIT
  // ============================================================================

  async logAuthorizationAttempt(
    request: AuthorizationRequest,
    result: AuthorizationResult
  ): Promise<void> {
    await this.auditService.log({
      actorUserId: request.userId,
      organizationId: request.organizationId,
      action: result.authorized ? 'authorization.granted' : 'authorization.denied',
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      metadata: {
        permission: request.permission,
        reason: result.reason,
        error: result.error,
        context: request.context,
      },
      ipAddress: request.context?.ipAddress,
      userAgent: request.context?.userAgent,
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async validateOrganizationAccess(
    userId: string,
    organizationId: string
  ): Promise<AuthorizationResult> {
    // Check organization exists and is active
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return this.deniedResult(
        AuthorizationReason.ORGANIZATION_NOT_FOUND,
        AuthorizationError.ORGANIZATION_NOT_FOUND
      );
    }

    if (organization.status !== 'ACTIVE') {
      return this.deniedResult(
        AuthorizationReason.ORGANIZATION_INACTIVE,
        AuthorizationError.ORGANIZATION_INACTIVE
      );
    }

    // Check user has active membership
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      return this.deniedResult(
        AuthorizationReason.NO_MEMBERSHIP,
        AuthorizationError.NO_MEMBERSHIP
      );
    }

    if (membership.status !== 'ACTIVE') {
      return this.deniedResult(
        AuthorizationReason.MEMBERSHIP_INACTIVE,
        this.getMembershipError(membership.status)
      );
    }

    return { authorized: true };
  }

  private async authorizeResourceAccess(
    request: AuthorizationRequest
  ): Promise<AuthorizationResult> {
    if (!request.resourceType || !request.resourceId) {
      return { authorized: true }; // No resource check needed
    }

    // Check if resource exists
    // This is a generic check - specific implementations may need to query different tables
    // For now, we'll use the resource_relationships table as a proxy
    
    // Check if user has any relationship with the resource
    const hasRelationship = await this.hasRelationship(
      request.userId,
      request.resourceType,
      request.resourceId,
      RelationshipType.OWNER, // Check for ownership first
      request.organizationId
    );

    if (hasRelationship) {
      return { authorized: true };
    }

    // If permission scope requires relationship and user doesn't have one
    const permissionScope = await this.getPermissionScope(request.permission);
    if (permissionScope === PermissionScope.RELATED || permissionScope === PermissionScope.OWNED) {
      return this.deniedResult(
        AuthorizationReason.RELATIONSHIP_REQUIRED,
        AuthorizationError.RELATIONSHIP_REQUIRED
      );
    }

    return { authorized: true };
  }

  private getMembershipError(status: string): AuthorizationError {
    switch (status) {
      case 'INVITED':
        return AuthorizationError.MEMBERSHIP_INVITED;
      case 'SUSPENDED':
        return AuthorizationError.MEMBERSHIP_SUSPENDED;
      case 'REMOVED':
        return AuthorizationError.MEMBERSHIP_REMOVED;
      default:
        return AuthorizationError.MEMBERSHIP_INACTIVE;
    }
  }

  private async getPermissionScope(permissionKey: PermissionKey): Promise<PermissionScope> {
    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
      select: { scope: true },
    });

    if (!permission) return PermissionScope.ORGANIZATION;

    return permission.scope as PermissionScope;
  }

  private deniedResult(
    reason: AuthorizationReason,
    error?: AuthorizationError
  ): AuthorizationResult {
    return {
      authorized: false,
      reason,
      error,
    };
  }

  private async buildAuthorizedResult(
    request: AuthorizationRequest
  ): Promise<AuthorizationResult> {
    const roles = await this.getUserRoles(request.userId, request.organizationId);
    const permissions = await this.getUserPermissions(request.userId, request.organizationId);

    return {
      authorized: true,
      reason: AuthorizationReason.AUTHORIZED,
      scope: await this.getPermissionScope(request.permission),
      roles: roles.map(r => r.slug),
      permissions,
    };
  }

  // ============================================================================
  // CACHE HELPERS
  // ============================================================================

  private buildCacheKey(request: AuthorizationRequest): string {
    return `auth:${request.userId}:${request.permission}:${request.organizationId || 'global'}:${request.resourceType || 'none'}:${request.resourceId || 'none'}`;
  }

  private getFromCache(key: string): CacheEntry | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  private setCache(key: string, value: any): void {
    if (!this.cacheConfig.enabled) return;

    // Implement size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const entry: CacheEntry = {
      key,
      value,
      expiresAt: new Date(Date.now() + this.cacheConfig.ttl * 1000),
    };

    this.cache.set(key, entry);
  }
}
