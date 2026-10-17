/**
 * Membership Service
 * Member listing, admin create-user-with-roles (auto temp password, must
 * change on first login), status changes, role assign/revoke.
 *
 * Guards (BUILD.md §1.3):
 * - cannot remove/demote the last active owner
 * - cannot assign a role you do not hold
 * - assigned roles must belong to the membership's organization (or be
 *   system roles) — cross-org role assignment is impossible
 */

import * as crypto from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "../prisma";
import { AuditService } from "../audit";
import { AccessError, ActorContext } from "./role.service";
import { isSingleOrgRole } from "./role-policy";

export interface MemberView {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  status: string;
  roles: Array<{ id: string; name: string; slug: string; isTemplate: boolean }>;
  joinedAt: Date;
}

const OWNER_SLUGS = new Set(["owner", "organization_owner"]);

export class MembershipService {
  private prisma: PrismaClient;
  private audit: AuditService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.audit = new AuditService(prisma);
  }

  async listMembers(organizationId: string): Promise<MemberView[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        roles: { include: { role: { select: { id: true, name: true, slug: true, isTemplate: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.displayName,
      status: m.status,
      roles: m.roles.map((mr) => mr.role),
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Admin flow: create a user and assign roles in one step. Returns the
   * generated temporary password ONCE (shown to the admin to pass along);
   * the user is flagged `mustChangePassword`.
   */
  async createUserWithRoles(
    actor: ActorContext,
    input: { email: string; name: string; roleIds: string[] },
  ): Promise<{ userId: string; tempPassword: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.name.trim()) {
      throw new AccessError(400, "Email and name are required");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AccessError(409, "A user with that email already exists");
    }

    const roles = await this.validateAssignableRoles(actor, input.roleIds);
    await this.assertNotAlreadyInAnotherOrg(email, null, roles);
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            displayName: input.name.trim(),
            passwordHash,
            mustChangePassword: true,
            status: "ACTIVE",
          },
        });
        const membership = await tx.organizationMember.create({
          data: { organizationId: actor.organizationId, userId: created.id, status: "ACTIVE" },
        });
        await tx.organizationMemberRole.createMany({
          data: roles.map((r) => ({ organizationMemberId: membership.id, roleId: r.id })),
          skipDuplicates: true,
        });
        return created;
      },
      { timeout: 30_000 },
    );

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "membership.create_user",
      resourceType: "user",
      resourceId: user.id,
      metadata: { email, roleIds: roles.map((r) => r.id) },
    });

    return { userId: user.id, tempPassword };
  }

  async setStatus(
    actor: ActorContext,
    membershipId: string,
    status: "ACTIVE" | "SUSPENDED" | "REMOVED",
  ): Promise<void> {
    const membership = await this.getMembership(actor.organizationId, membershipId);

    if (status !== "ACTIVE") {
      await this.assertNotLastOwner(membership);
    }

    await this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: { status },
    });

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: `membership.${status.toLowerCase()}`,
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { userId: membership.userId },
    });
  }

  /**
   * Update a member's editable profile fields.
   *
   * Editable: `name` only. The email is the immutable login identity and is
   * NEVER editable here — it is how the user authenticates and is shared
   * across every organization they belong to. Changing it would break their
   * other tenants, so it is intentionally locked.
   *
   * Note: `User.name` is global to the user (shared across all organizations
   * they belong to), since a person has one name regardless of tenant.
   */
  async updateMember(
    actor: ActorContext,
    membershipId: string,
    input: { name?: string },
  ): Promise<void> {
    const membership = await this.getMembership(actor.organizationId, membershipId);

    const data: { name?: string } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new AccessError(400, "Name cannot be empty.");
      }
      data.name = name;
    }

    if (Object.keys(data).length === 0) {
      throw new AccessError(400, "Nothing to update.");
    }

    await this.prisma.user.update({
      where: { id: membership.userId },
      data,
    });

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "membership.update",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { userId: membership.userId, fields: Object.keys(data) },
    });
  }

  async assignRoles(actor: ActorContext, membershipId: string, roleIds: string[]): Promise<void> {
    const membership = await this.getMembership(actor.organizationId, membershipId);
    const roles = await this.validateAssignableRoles(actor, roleIds);
    await this.assertNotAlreadyInAnotherOrg(membership.userId, membership.id, roles);

    await this.prisma.organizationMemberRole.createMany({
      data: roles.map((r) => ({ organizationMemberId: membership.id, roleId: r.id })),
      skipDuplicates: true,
    });

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "role.assign",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { roleIds: roles.map((r) => r.id) },
    });
  }

  async revokeRoles(actor: ActorContext, membershipId: string, roleIds: string[]): Promise<void> {
    const membership = await this.getMembership(actor.organizationId, membershipId);

    // Last-owner guard: revoking an owner role from the final active owner
    const currentRoles = await this.prisma.organizationMemberRole.findMany({
      where: { organizationMemberId: membership.id },
      include: { role: true },
    });
    const losingOwner = currentRoles.some(
      (cr) => OWNER_SLUGS.has(cr.role.slug) && roleIds.includes(cr.role.id),
    );
    if (losingOwner) {
      await this.assertNotLastOwner(membership);
    }

    await this.prisma.organizationMemberRole.deleteMany({
      where: { organizationMemberId: membership.id, roleId: { in: roleIds } },
    });

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "role.revoke",
      resourceType: "membership",
      resourceId: membership.id,
      metadata: { roleIds },
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async getMembership(organizationId: string, membershipId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new AccessError(404, "Membership not found");
    }
    return membership;
  }

  /** Roles must be system or belong to this org; assignment rights checked. */
  private async validateAssignableRoles(actor: ActorContext, roleIds: string[]) {
    const uniqueIds = [...new Set(roleIds)];
    if (uniqueIds.length === 0) {
      throw new AccessError(400, "At least one role is required");
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (roles.length !== uniqueIds.length) {
      throw new AccessError(404, "One or more roles not found");
    }

    const outOfScope = roles.filter(
      (r) => r.organizationId !== null && r.organizationId !== actor.organizationId,
    );
    if (outOfScope.length > 0) {
      throw new AccessError(403, "Cannot assign roles from another organization");
    }

    // role.manage holders may assign any role of this organization (needed so
    // owners can hand out freshly created custom roles). Otherwise the actor
    // must hold every role they assign.
    const actorPermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          organizationId: actor.organizationId,
          memberRoles: {
            some: {
              organizationMember: { userId: actor.userId, organizationId: actor.organizationId },
            },
          },
        },
      },
      include: { permission: true },
    });
    const heldPermissionKeys = new Set(actorPermissions.map((p) => p.permission.key));
    if (heldPermissionKeys.has("role.manage")) {
      return roles;
    }

    const held = new Set(actorPermissions.map((p) => p.roleId));
    const notHeld = roles.filter((r) => !held.has(r.id));
    if (notHeld.length > 0) {
      throw new AccessError(
        403,
        `Cannot assign roles you do not hold: ${notHeld.map((r) => r.slug).join(", ")}`,
      );
    }

    return roles;
  }

  /**
   * Staff roles are single-organization. When the roles being granted
   * include a single-org role, the user must not already hold an ACTIVE
   * membership in a DIFFERENT organization. Owners/admins are exempt (they
   * may legitimately span orgs).
   *
   * @param currentMembershipId the membership being modified, or null when
   *   creating a brand-new user (email lookup instead).
   */
  private async assertNotAlreadyInAnotherOrg(
    userIdOrEmail: string,
    currentMembershipId: string | null,
    roles: Array<{ slug: string }>,
  ): Promise<void> {
    const grantsSingleOrgRole = roles.some((r) => isSingleOrgRole(r.slug));
    if (!grantsSingleOrgRole) return;

    // Resolve the user (create flow passes email, assign flow passes userId).
    const user = await this.prisma.user.findFirst({
      where: userIdOrEmail.includes("@")
        ? { email: userIdOrEmail }
        : { id: userIdOrEmail },
      select: { id: true },
    });
    if (!user) return;

    const otherOrgMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        ...(currentMembershipId ? { id: { not: currentMembershipId } } : {}),
      },
      select: { organizationId: true },
    });

    if (otherOrgMembership) {
      throw new AccessError(
        409,
        "This person already belongs to another organization. Staff roles can only belong to one organization — remove them from their other organization first, or grant an owner/admin role instead.",
      );
    }
  }

  /** A member is an "owner" if they hold any owner-slug role. */
  private async assertNotLastOwner(
    membership: { id: string; organizationId: string; status: string },
  ) {
    const memberRoles = await this.prisma.organizationMemberRole.findMany({
      where: { organizationMemberId: membership.id },
      include: { role: true },
    });
    if (!memberRoles.some((mr) => OWNER_SLUGS.has(mr.role.slug))) {
      return; // not an owner — no guard needed
    }

    const otherOwners = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: membership.organizationId,
        status: "ACTIVE",
        id: { not: membership.id },
        roles: { some: { role: { slug: { in: [...OWNER_SLUGS] } } } },
      },
    });

    if (!otherOwners) {
      throw new AccessError(409, "Cannot remove or suspend the last active owner");
    }
  }
}
