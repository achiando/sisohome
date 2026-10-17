/**
 * Tenant Service
 * Explicit tenant context management
 */

import { PrismaClient } from '../prisma';
import {
  TenantRequiredError,
  TenantNotFoundError,
  MembershipRequiredError,
  MembershipInactiveError,
} from './types';

export class TenantService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Require tenant context - throw if not provided
   * @param organizationId - Organization ID to validate
   * @throws TenantRequiredError if organizationId is null/undefined
   */
  requireTenant(organizationId: string | null): void {
    if (!organizationId) {
      throw new TenantRequiredError('Organization context is required');
    }
  }

  /**
   * Validate organization exists and is active
   * @param organizationId - Organization ID to validate
   * @returns Organization if valid
   * @throws TenantNotFoundError if organization doesn't exist
   */
  async validateOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new TenantNotFoundError(`Organization not found: ${organizationId}`);
    }

    if (organization.status !== 'ACTIVE') {
      throw new TenantNotFoundError(`Organization is not active: ${organizationId}`);
    }

    return organization;
  }

  /**
   * Validate user has active membership in organization
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @throws MembershipRequiredError if no membership exists
   * @throws MembershipInactiveError if membership is not active
   */
  async validateMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new MembershipRequiredError(
        `User ${userId} is not a member of organization ${organizationId}`
      );
    }

    if (membership.status !== 'ACTIVE') {
      throw new MembershipInactiveError(
        `User membership is ${membership.status.toLowerCase()} for organization ${organizationId}`
      );
    }
  }

  /**
   * Get organizations accessible to a user
   * @param userId - User ID
   * @returns Array of organization IDs
   */
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

  /**
   * Get full membership list for a user (onboarding picker + shell switcher).
   * Each entry carries org identity, kind, and the member's role slugs.
   */
  async getMemberships(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, kind: true, status: true },
        },
        roles: {
          include: { role: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    return memberships.map((m) => ({
      organizationId: m.organizationId,
      membershipId: m.id,
      organization: m.organization,
      roles: m.roles.map((mr) => mr.role),
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Check if user can access organization
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns true if user has active membership
   */
  async canAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
    try {
      await this.validateMembership(userId, organizationId);
      return true;
    } catch {
      return false;
    }
  }

  async canUserAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
    return this.canAccessOrganization(userId, organizationId);
  }

  /**
   * Switch active organization context
   * @param userId - User ID
   * @param newOrganizationId - New organization ID
   * @returns true if switch successful
   */
  async switchOrganization(userId: string, newOrganizationId: string): Promise<boolean> {
    const canAccess = await this.canAccessOrganization(userId, newOrganizationId);
    return canAccess;
  }
}
