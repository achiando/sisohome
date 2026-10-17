/**
 * Authentication Service
 * Provider-independent authentication layer
 */

import { PrismaClient } from '../prisma';
import {
  AuthenticationProvider,
  AuthenticatedIdentity,
  UnauthenticatedError,
  InvalidSessionError,
  AuthenticationProviderError,
} from './types';

export class AuthenticationService {
  private prisma: PrismaClient;
  private provider: AuthenticationProvider;

  constructor(prisma: PrismaClient, provider: AuthenticationProvider) {
    this.prisma = prisma;
    this.provider = provider;
  }

  /**
   * Verify authentication session and resolve application user
   * @param session - Session token or identifier
   * @returns Authenticated identity with application user ID
   */
  async verifySession(session: unknown): Promise<AuthenticatedIdentity> {
    try {
      const identity = await this.provider.verifySession(session);

      // Resolve application user from auth identity
      const user = await this.prisma.user.findUnique({
        where: { id: identity.userId },
      });

      if (!user) {
        throw new UnauthenticatedError('User not found in application');
      }

      if (user.status !== 'ACTIVE') {
        throw new InvalidSessionError('User account is not active');
      }

      return {
        ...identity,
        userId: user.id,
      };
    } catch (error) {
      if (error instanceof UnauthenticatedError || error instanceof InvalidSessionError) {
        throw error;
      }
      throw new AuthenticationProviderError(
        'Failed to verify session',
        this.provider.constructor.name,
        error
      );
    }
  }

  /**
   * Revoke a session
   * @param sessionId - Session identifier
   */
  async revokeSession(sessionId: string): Promise<void> {
    if (!this.provider.revokeSession) {
      console.warn('Provider does not support session revocation');
      return;
    }

    try {
      await this.provider.revokeSession(sessionId);
    } catch (error) {
      throw new AuthenticationProviderError(
        'Failed to revoke session',
        this.provider.constructor.name,
        error
      );
    }
  }

  /**
   * Refresh a session
   * @param sessionId - Session identifier
   * @returns New session data or null
   */
  async refreshSession(sessionId: string): Promise<unknown | null> {
    if (!this.provider.refreshSession) {
      console.warn('Provider does not support session refresh');
      return null;
    }

    try {
      return await this.provider.refreshSession(sessionId);
    } catch (error) {
      throw new AuthenticationProviderError(
        'Failed to refresh session',
        this.provider.constructor.name,
        error
      );
    }
  }

  /**
   * Get the underlying authentication provider
   */
  getProvider(): AuthenticationProvider {
    return this.provider;
  }
}
