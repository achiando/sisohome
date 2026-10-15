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
      authUserId: session.user.authUserId || session.user.id,
      sessionId: session.id,
      email: session.user.email,
      metadata: {
        organizationId: session.organizationId,
      },
    };
  }

  /**
   * Get identity by auth user ID
   */
  async getIdentity(authUserId: string): Promise<AuthenticatedIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return {
      userId: user.id,
      authUserId: user.authUserId || user.id,
      email: user.email,
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

    // Get user's default organization
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        organizationId: membership?.organizationId || null,
      },
    });

    return {
      userId: user.id,
      authUserId: user.authUserId || user.id,
      sessionId: session.id,
      email: user.email,
      metadata: {
        organizationId: session.organizationId,
      },
    };
  }

  /**
   * Sign up with email, password, and name
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

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        authUserId: this.generateAuthUserId(),
        status: 'ACTIVE',
        profile: {
          create: {
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' ') || '',
          },
        },
      },
    });

    // Create default organization for the user
    const organization = await this.prisma.organization.create({
      data: {
        name: `${name}'s Organization`,
        slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        status: 'ACTIVE',
      },
    });

    // Add user as owner of the organization
    // First, find or create the owner role
    let ownerRole = await this.prisma.role.findUnique({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'owner',
        },
      },
    });

    if (!ownerRole) {
      ownerRole = await this.prisma.role.create({
        data: {
          organizationId: organization.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Organization owner with full access',
          isSystem: true,
        },
      });
    }

    await this.prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        status: 'ACTIVE',
        roles: {
          create: {
            role: {
              connect: {
                id: ownerRole.id,
              },
            },
          },
        },
      },
    });

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        organizationId: organization.id,
      },
    });

    return {
      userId: user.id,
      authUserId: user.authUserId,
      sessionId: session.id,
      email: user.email,
      metadata: {
        organizationId: session.organizationId,
      },
    };
  }

  /**
   * Generate a random session token
   */
  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Generate a random auth user ID
   */
  private generateAuthUserId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}
