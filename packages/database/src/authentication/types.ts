/**
 * Authentication Types and Interfaces
 * Provider-independent authentication abstraction
 */

// ============================================================================
// AUTHENTICATED IDENTITY
// ============================================================================

export interface AuthenticatedIdentity {
  userId: string;
  authUserId: string;
  sessionId?: string;
  email?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// AUTHENTICATION PROVIDER INTERFACE
// ============================================================================

export interface AuthenticationProvider {
  /**
   * Verify and validate an authentication session/token
   * @param input - Session token, JWT, or other auth identifier
   * @returns Authenticated identity if valid
   */
  verifySession(input: unknown): Promise<AuthenticatedIdentity>;

  /**
   * Get identity by auth user ID (e.g., Supabase user ID)
   * @param authUserId - External auth provider user ID
   * @returns Authenticated identity or null if not found
   */
  getIdentity(authUserId: string): Promise<AuthenticatedIdentity | null>;

  /**
   * Revoke a session (optional - not all providers support this)
   * @param sessionId - Session identifier to revoke
   */
  revokeSession?(sessionId: string): Promise<void>;

  /**
   * Refresh a session/token (optional)
   * @param sessionId - Session identifier to refresh
   * @returns New session data or null
   */
  refreshSession?(sessionId: string): Promise<unknown | null>;
}

// ============================================================================
// AUTHENTICATION CONTEXT
// ============================================================================

export interface AuthContext {
  userId: string;
  authUserId: string;
  sessionId?: string;
  organizationId: string | null;
  email?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// AUTHENTICATION ERRORS
// ============================================================================

export class UnauthenticatedError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class InvalidSessionError extends Error {
  constructor(message: string = 'Invalid or expired session') {
    super(message);
    this.name = 'InvalidSessionError';
  }
}

export class AuthenticationProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthenticationProviderError';
  }
}
