/**
 * Organization Service
 * Creating organizations (anytime — onboarding or later growth), wiring the
 * kind role templates, membership + owner role assignment.
 *
 * Multi-org invariant: a user can hold many memberships across kinds; this
 * service is the ONLY path that creates orgs + seeds their roles.
 */

import { PrismaClient } from "../prisma";
import { seedOrgKindRoles, OrganizationKindValue } from "../seed/org-kind-templates";
import { AuditService } from "../audit";
import { SINGLE_ORG_ROLE_SLUGS } from "../access/role-policy";
import { TenantNotFoundError, MembershipRequiredError } from "./types";

const KINDS: OrganizationKindValue[] = [
  "LANDLORD",
  "PROPERTY_MANAGEMENT",
  "MAINTENANCE_COMPANY",
  "MARKETING_AGENT",
];

export interface CreateOrganizationInput {
  userId: string;
  name: string;
  kind: OrganizationKindValue;
}

export interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKindValue;
}

export class OrganizationService {
  private prisma: PrismaClient;
  private audit: AuditService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.audit = new AuditService(prisma);
  }

  /**
   * Create an organization of the given kind, seed its role templates, add
   * the creator as an ACTIVE member holding the kind's `owner` template role,
   * and mark onboarding complete. All in one transaction.
   */
  async createOrganization(input: CreateOrganizationInput): Promise<CreatedOrganization> {
    const { userId, name, kind } = input;

    if (!KINDS.includes(kind)) {
      throw new Error(`Unknown organization kind: ${kind}`);
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Organization name is required");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new TenantNotFoundError(`User not found: ${userId}`);
    }

    // Single-org rule: a holder of a staff role may belong to exactly ONE
    // active organization. Creating another org here would put them in two.
    // (Owner/admin holders are fine — they may span orgs.)
    const staffMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        roles: { some: { role: { slug: { in: [...SINGLE_ORG_ROLE_SLUGS] } } } },
      },
      select: { organization: { select: { name: true } } },
    });
    if (staffMembership) {
      throw new Error(
        `You hold a staff role in "${staffMembership.organization.name}", and staff roles are single-organization. ` +
          `Ask an admin of that organization to remove you first, then create your workspace.`,
      );
    }

    const slug = await this.generateUniqueSlug(trimmedName);

    const organization = await this.prisma.$transaction(
      async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: trimmedName,
          slug,
          kind,
          status: "ACTIVE",
        },
      });

      // Seed this kind's template roles (owner/admin/... per BUILD.md §1.1)
      await seedOrgKindRoles(tx as never, org.id, kind);

      // Membership for the creator
      const membership = await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          status: "ACTIVE",
        },
      });

      // Assign the kind's `owner` template role
      const ownerRole = await tx.role.findFirst({
        where: { organizationId: org.id, slug: "owner" },
      });
      if (!ownerRole) {
        throw new Error(`Owner template role missing after seeding kind ${kind}`);
      }
      await tx.organizationMemberRole.create({
        data: {
          organizationMemberId: membership.id,
          roleId: ownerRole.id,
        },
      });

      // First org completes onboarding; later orgs leave the flag alone
      if (!user.onboardingCompletedAt) {
        await tx.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: new Date() },
        });
      }

      return org;
      },
      // Template seeding is chatty (roles + permissions per kind); the remote
      // dev DB needs more than the 5s default.
      { timeout: 30_000 },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: organization.id,
      action: "organization.create",
      resourceType: "organization",
      resourceId: organization.id,
      metadata: { kind, slug: organization.slug },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      kind,
    };
  }

  /**
   * Update an organization's display name. The organizationId comes from the
   * caller's session context (never from client input), so this is inherently
   * tenant-scoped — permission checks happen in the API layer.
   */
  async updateOrganization(input: {
    organizationId: string;
    name: string;
  }): Promise<CreatedOrganization> {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Organization name is required");
    }
    if (trimmed.length > 80) {
      throw new Error("Organization name must be 80 characters or fewer");
    }

    const existing = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new TenantNotFoundError(
        `Organization not found: ${input.organizationId}`,
      );
    }

    const org = await this.prisma.organization.update({
      where: { id: input.organizationId },
      data: { name: trimmed },
      select: { id: true, name: true, slug: true, kind: true },
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      kind: org.kind as OrganizationKindValue,
    };
  }

  /**
   * Validate a user may activate an organization (used by onboarding "pick
   * one" and the shell org switcher).
   */
  async assertCanActivate(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) {
      throw new MembershipRequiredError(
        `User ${userId} is not a member of organization ${organizationId}`,
      );
    }
    if (membership.status !== "ACTIVE") {
      throw new MembershipRequiredError(
        `Membership is ${membership.status.toLowerCase()} for organization ${organizationId}`,
      );
    }
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.status !== "ACTIVE") {
      throw new TenantNotFoundError(`Organization is not active: ${organizationId}`);
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "org";

    for (let attempt = 0; attempt < 25; attempt++) {
      const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 8)}`;
      const candidate = `${base}${suffix}`;
      const existing = await this.prisma.organization.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
    }
    // Pathological fallback
    return `${base}-${Date.now().toString(36)}`;
  }
}
