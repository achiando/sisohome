/**
 * Tenancy Types and Errors
 * Explicit tenant context management
 */

// ============================================================================
// TENANT CONTEXT
// ============================================================================

export interface TenantContext {
  organizationId: string;
  organizationName?: string;
  userId: string;
  membershipId?: string;
}

// ============================================================================
// TENANT ERRORS
// ============================================================================

export class TenantRequiredError extends Error {
  constructor(message: string = 'Organization context is required') {
    super(message);
    this.name = 'TenantRequiredError';
  }
}

export class TenantNotFoundError extends Error {
  constructor(message: string = 'Organization not found') {
    super(message);
    this.name = 'TenantNotFoundError';
  }
}

export class MembershipRequiredError extends Error {
  constructor(message: string = 'Organization membership required') {
    super(message);
    this.name = 'MembershipRequiredError';
  }
}

export class MembershipInactiveError extends Error {
  constructor(message: string = 'Organization membership is not active') {
    super(message);
    this.name = 'MembershipInactiveError';
  }
}
