/**
 * Authorization System Entry Point
 * Enterprise-scale, domain-agnostic authorization layer
 */

export * from './types';
export * from './authorization.service';
export * from './middleware';

// Re-export common utilities for convenience
export { AuthorizationService } from './authorization.service';
export { createAuthorizationMiddleware, AuthorizationHelper, createPermissionChecker } from './middleware';
