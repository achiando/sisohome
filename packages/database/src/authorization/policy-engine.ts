/**
 * Policy Engine
 * Resource-specific authorization policies
 */

import { AuthContext } from '../authentication/types';

// ============================================================================
// POLICY INTERFACE
// ============================================================================

export interface AuthorizationPolicy<TResource = unknown> {
  resourceType: string;

  /**
   * Check if user can perform action on resource
   * @param action - Action being performed (e.g., 'read', 'update')
   * @param context - Authentication context
   * @param resource - Resource being accessed
   * @returns true if action is allowed
   */
  can(
    action: string,
    context: AuthContext,
    resource: TResource
  ): Promise<boolean>;
}

// ============================================================================
// POLICY ENGINE
// ============================================================================

export class PolicyEngine {
  private policies: Map<string, AuthorizationPolicy> = new Map();

  /**
   * Register a policy for a resource type
   * @param policy - Policy to register
   */
  registerPolicy<TResource>(policy: AuthorizationPolicy<TResource>): void {
    this.policies.set(policy.resourceType, policy);
  }

  /**
   * Unregister a policy
   * @param resourceType - Resource type to unregister
   */
  unregisterPolicy(resourceType: string): void {
    this.policies.delete(resourceType);
  }

  /**
   * Get policy for resource type
   * @param resourceType - Resource type
   * @returns Policy or null if not registered
   */
  getPolicy(resourceType: string): AuthorizationPolicy | null {
    return this.policies.get(resourceType) || null;
  }

  /**
   * Check if action is allowed using registered policy
   * @param resourceType - Resource type
   * @param action - Action being performed
   * @param context - Authentication context
   * @param resource - Resource being accessed
   * @returns true if allowed, false if denied or no policy
   */
  async can(
    resourceType: string,
    action: string,
    context: AuthContext,
    resource: unknown
  ): Promise<boolean> {
    const policy = this.getPolicy(resourceType);

    if (!policy) {
      // No policy registered - default to deny
      return false;
    }

    return policy.can(action, context, resource);
  }

  /**
   * Check if action is allowed, throw if denied
   * @param resourceType - Resource type
   * @param action - Action being performed
   * @param context - Authentication context
   * @param resource - Resource being accessed
   * @throws Error if denied
   */
  async require(
    resourceType: string,
    action: string,
    context: AuthContext,
    resource: unknown
  ): Promise<void> {
    const allowed = await this.can(resourceType, action, context, resource);

    if (!allowed) {
      throw new Error(
        `Access denied: ${action} on ${resourceType} for user ${context.userId}`
      );
    }
  }

  /**
   * Get all registered resource types
   * @returns Array of resource type strings
   */
  getRegisteredResourceTypes(): string[] {
    return Array.from(this.policies.keys());
  }
}
