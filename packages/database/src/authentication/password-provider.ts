/**
 * Password-based Authentication Provider
 * Simple local password authentication for development/testing
 * In production, use a proper auth provider (Supabase, Clerk, etc.)
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '../prisma';
import {
  AuthenticationProvider,
  AuthenticatedIdentity,
  UnauthenticatedError,
} from './types';

export class PasswordAuthProvider implements AuthenticationProvider {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Verify session token (JWT or session ID)
   * For simplicity, we'll use a session stored in the database
   */
  async verifySession(input: unknown): Promise<AuthenticatedIdentity> {
    if (typeof input !== 'string') {
      throw new UnauthenticatedError('Invalid session token');
    }

    const session = await this.prisma.session.findUnique({
      where: { token: input },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthenticatedError('Invalid or expired session');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthenticatedError('User account is not active');
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      email: session.user.email,
      metadata: {
        organizationId: session.organizationId,
      },
    };
  }

  /**
   * Revoke a session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    }).catch(() => {
      // Session might not exist, that's okay
    });
  }

  /**
   * Refresh a session
   */
  async refreshSession(sessionId: string): Promise<unknown | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return null;

    // Extend session by 1 hour
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    return {
      token: updated.token,
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Verify an email/password pair WITHOUT creating a session.
   *
   * Used when a second factor still has to be proven: the login route must
   * check the password first, then stop short of issuing a session.
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Create a session for a user whose credentials — and second factor, when
   * enabled — have already been proven.
   *
   * Active organization rule (multi-org invariant: never guess):
   *  - exactly ONE active membership  → auto-activate it
   *  - ZERO or MULTIPLE memberships   → null, the user picks on onboarding
   */
  async issueSession(userId: string): Promise<AuthenticatedIdentity | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    const activeMemberships = await this.prisma.organizationMember.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    const only = activeMemberships.length === 1 ? activeMemberships[0] : undefined;
    const autoOrgId = only ? only.organizationId : null;

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        organizationId: autoOrgId,
      },
    });

    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      metadata: {
        organizationId: session.organizationId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthenticatedIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    // Check if user has a password hash
    if (!user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return this.issueSession(user.id);
  }

  /**
   * Sign up with email, password, and name.
   *
   * Creates ONLY the user account and a session with no active organization.
   * Organization creation happens later via onboarding, where the chosen
   * organization kind seeds that kind's role templates (see
   * `seedOrgKindRoles`). This lets one user own/operate across multiple
   * organizations of different kinds.
   */
  async signUp(email: string, password: string, name: string): Promise<AuthenticatedIdentity | null> {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return null;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (no organization, no roles yet)
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: name,
        status: 'ACTIVE',
        profile: {
          create: {
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' ') || undefined,
          },
        },
      },
    });

    // Create session with no active organization (onboarding will set one)
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        organizationId: null,
      },
    });

    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      metadata: {
        organizationId: null,
        onboardingRequired: true,
      },
    };
  }

  /**
   * Change password for an authenticated user.
   * When the user was flagged `mustChangePassword` (admin-created temp
   * password), the caller must present that current password; success clears
   * the flag.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      return false;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return false;
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return true;
  }

  /**
   * Set a password WITHOUT knowing the old one.
   *
   * Only the emailed reset flow may call this: the route has already proven
   * possession of a single-use reset token, so there is no current password
   * to check. Enforces the same strength rules as the client's reset form so
   * the server never accepts a password the form would have rejected.
   */
  async setPassword(userId: string, newPassword: string): Promise<boolean> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one special character');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return true;
  }

  /**
   * Generate a random session token
   */
  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
