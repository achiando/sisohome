/**
 * Authorization System Entry Point
 * Enterprise-scale, domain-agnostic authorization layer
 */

export * from './types';
export * from './authorization.service';
export * from './middleware';
export * from './policy-engine';
export * from './guards';
export * from './session-cache';
export * from './api-routes';
export * from './middleware-auth';

// Re-export common utilities for convenience
export { AuthorizationService } from './authorization.service';
export { createAuthorizationMiddleware, AuthorizationHelper, createPermissionChecker } from './middleware';
export { createAuthApiRoutes, protectRoute, getAuthContextFromRequest } from './api-routes';
export { createAuthMiddleware, getServerAuthContext, getServerPermissions, getServerRoles } from './middleware-auth';
