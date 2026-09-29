/**
 * Authorization Types and Interfaces
 * Enterprise-scale, domain-agnostic authorization system
 */

// ============================================================================
// PERMISSION STRUCTURE
// ============================================================================

/**
 * Permission scope determines where a permission applies
 */
export enum PermissionScope {
  GLOBAL = 'GLOBAL',           // Platform-wide permission
  ORGANIZATION = 'ORGANIZATION', // Within organization context
  RELATED = 'RELATED',         // Through resource relationships
  OWNED = 'OWNED',            // Resources owned by user
  ASSIGNED = 'ASSIGNED'       // Resources assigned to user
}

/**
 * Permission action types following RESTful conventions
 */
export enum PermissionAction {
  // CRUD operations
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  
  // List/View operations
  LIST = 'list',
  VIEW = 'view',
  
  // Special operations
  MANAGE = 'manage',           // Full control
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  REJECT = 'reject',
  PUBLISH = 'publish',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  
  // Special actions
  SHARE = 'share',
  TRANSFER = 'transfer',
  ASSIGN = 'assign',
  REVOKE = 'revoke',
}

/**
 * Resource types - generic, domain-agnostic
 * Future modules can extend this
 */
export enum ResourceType {
  // Foundation resources
  ORGANIZATION = 'organization',
  USER = 'user',
  MEMBERSHIP = 'membership',
  ROLE = 'role',
  PERMISSION = 'permission',
  AUDIT_LOG = 'audit_log',
  
  // Generic resources for future domains
  RESOURCE = 'resource',
  PROJECT = 'project',
  DOCUMENT = 'document',
  FILE = 'file',
  COMMENT = 'comment',
  
  // Custom resources can be added dynamically
}

/**
 * Permission key format: resource.action
 * Example: organization.read, user.update
 */
export type PermissionKey = `${ResourceType}.${PermissionAction}`;

/**
 * Relationship types for resource access
 */
export enum RelationshipType {
  OWNER = 'owner',
  MEMBER = 'member',
  MANAGER = 'manager',
  ADMIN = 'admin',
  VIEWER = 'viewer',
  EDITOR = 'editor',
  CONTRIBUTOR = 'contributor',
  FOLLOWER = 'follower',
  ASSIGNEE = 'assignee',
  REVIEWER = 'reviewer',
  APPROVER = 'approver',
}

// ============================================================================
// AUTHORIZATION REQUEST
// ============================================================================

export interface AuthorizationRequest {
  userId: string;
  permission: PermissionKey;
  resourceType?: ResourceType;
  resourceId?: string;
  organizationId?: string;
  context?: AuthorizationContext;
}

export interface AuthorizationContext {
  // Additional context for authorization decisions
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// AUTHORIZATION RESULT
// ============================================================================

export interface AuthorizationResult {
  authorized: boolean;
  reason?: AuthorizationReason;
  error?: AuthorizationError;
  scope?: PermissionScope;
  roles?: string[];
  permissions?: string[];
}

export enum AuthorizationReason {
  AUTHORIZED = 'authorized',
  UNAUTHENTICATED = 'unauthenticated',
  USER_NOT_FOUND = 'user_not_found',
  USER_INACTIVE = 'user_inactive',
  ORGANIZATION_NOT_FOUND = 'organization_not_found',
  ORGANIZATION_INACTIVE = 'organization_inactive',
  NO_MEMBERSHIP = 'no_membership',
  MEMBERSHIP_INACTIVE = 'membership_inactive',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  RELATIONSHIP_REQUIRED = 'relationship_required',
  RELATIONSHIP_INVALID = 'relationship_invalid',
  RELATIONSHIP_EXPIRED = 'relationship_expired',
  ACCESS_DENIED = 'access_denied',
  SYSTEM_ERROR = 'system_error',
}

export enum AuthorizationError {
  // User errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INACTIVE = 'USER_INACTIVE',
  USER_SUSPENDED = 'USER_SUSPENDED',
  
  // Organization errors
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_INACTIVE = 'ORGANIZATION_INACTIVE',
  ORGANIZATION_SUSPENDED = 'ORGANIZATION_SUSPENDED',
  
  // Membership errors
  NO_MEMBERSHIP = 'NO_MEMBERSHIP',
  MEMBERSHIP_INVITED = 'MEMBERSHIP_INVITED',
  MEMBERSHIP_SUSPENDED = 'MEMBERSHIP_SUSPENDED',
  MEMBERSHIP_REMOVED = 'MEMBERSHIP_REMOVED',
  
  // Permission errors
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  PERMISSION_SCOPE_MISMATCH = 'PERMISSION_SCOPE_MISMATCH',
  
  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',
  
  // Relationship errors
  RELATIONSHIP_REQUIRED = 'RELATIONSHIP_REQUIRED',
  RELATIONSHIP_INVALID = 'RELATIONSHIP_INVALID',
  RELATIONSHIP_EXPIRED = 'RELATIONSHIP_EXPIRED',
  
  // System errors
  AUTHORIZATION_SERVICE_ERROR = 'AUTHORIZATION_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

// ============================================================================
// ROLE AND PERMISSION STRUCTURES
// ============================================================================

export interface Role {
  id: string;
  organizationId?: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  key: PermissionKey;
  name: string;
  description?: string;
  scope: PermissionScope;
}

export interface RoleAssignment {
  memberId: string;
  roleId: string;
  role: Role;
}

// ============================================================================
// RESOURCE RELATIONSHIP
// ============================================================================

export interface ResourceRelationship {
  id: string;
  subjectType: string;
  subjectId: string;
  relationship: RelationshipType;
  resourceType: ResourceType;
  resourceId: string;
  organizationId?: string;
  metadata?: Record<string, any>;
  startsAt?: Date;
  endsAt?: Date;
  isValid: boolean;
}

// ============================================================================
// CACHE STRATEGY
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number;
  strategy: 'memory' | 'redis' | 'database';
}

export interface CacheEntry {
  key: string;
  value: any;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// AUTHORIZATION SERVICE INTERFACE
// ============================================================================

export interface IAuthorizationService {
  // Core authorization
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
  checkPermission(userId: string, permission: PermissionKey, organizationId?: string): Promise<boolean>;
  
  // User authorization
  getUserPermissions(userId: string, organizationId?: string): Promise<PermissionKey[]>;
  getUserRoles(userId: string, organizationId?: string): Promise<Role[]>;
  
  // Resource authorization
  canAccessResource(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: PermissionKey,
    organizationId?: string
  ): Promise<AuthorizationResult>;
  
  // Relationship authorization
  hasRelationship(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    relationship: RelationshipType,
    organizationId?: string
  ): Promise<boolean>;
  
  // Organization authorization
  canUserAccessOrganization(userId: string, organizationId: string): Promise<boolean>;
  getUserOrganizations(userId: string): Promise<string[]>;
  
  // Cache management
  clearCache(userId?: string, organizationId?: string): Promise<void>;
  warmCache(userId: string, organizationId?: string): Promise<void>;
  
  // Audit
  logAuthorizationAttempt(request: AuthorizationRequest, result: AuthorizationResult): Promise<void>;
}

// ============================================================================
// MIDDLEWARE AND HOOK TYPES
// ============================================================================

export interface AuthorizationMiddlewareOptions {
  permission: PermissionKey;
  resourceType?: ResourceType;
  resourceParam?: string; // URL parameter name for resource ID
  organizationParam?: string; // URL parameter name for organization ID
  requireOrganization?: boolean;
  checkRelationship?: boolean;
  requiredRelationship?: RelationshipType;
}

export interface AuthenticatedRequest {
  userId: string;
  organizationId?: string;
  user?: any;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AuthorizationException extends Error {
  constructor(
    public error: AuthorizationError,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthorizationException';
  }
}

export class PermissionDeniedException extends AuthorizationException {
  constructor(permission: PermissionKey, details?: Record<string, any>) {
    super(
      AuthorizationError.INSUFFICIENT_PERMISSIONS,
      `Permission denied: ${permission}`,
      details
    );
    this.name = 'PermissionDeniedException';
  }
}

export class MembershipRequiredException extends AuthorizationException {
  constructor(organizationId: string, details?: Record<string, any>) {
    super(
      AuthorizationError.NO_MEMBERSHIP,
      `Membership required for organization: ${organizationId}`,
      details
    );
    this.name = 'MembershipRequiredException';
  }
}

export class OrganizationAccessException extends AuthorizationException {
  constructor(organizationId: string, details?: Record<string, any>) {
    super(
      AuthorizationError.RESOURCE_ACCESS_DENIED,
      `Access denied to organization: ${organizationId}`,
      details
    );
    this.name = 'OrganizationAccessException';
  }
}
