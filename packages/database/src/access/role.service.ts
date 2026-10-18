/**
 * Organization Role Service
 * Org-scoped role management with the Phase 1 guardrails:
 * - system AND template roles are non-deletable (only custom roles deletable)
 * - template role permissions stay editable by org owners; system roles are
 *   read-only (seed/platform-admin domain)
 * - you can never grant a permission you do not yourself hold
 * - every query is scoped to the caller's active organization
 */

import { PrismaClient } from "../prisma";
import { AuditService } from "../audit";
import { isSingleOrgRole } from "./role-policy";

/** Structural subset of the client used inside transactions. */
interface TxClient {
  rolePermission: Pick<PrismaClient["rolePermission"], "deleteMany" | "createMany">;
  permission: Pick<PrismaClient["permission"], "findMany">;
}

export class AccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RoleView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isTemplate: boolean;
  /** Staff/single-org roles: the holder may belong to only one organization. */
  singleOrg: boolean;
  permissions: string[];
  memberCount: number;
}

export interface ActorContext {
  userId: string;
  organizationId: string;
}

export class OrgRoleService {
  private prisma: PrismaClient;
  private audit: AuditService;
  private onRolesChanged?: ((organizationId: string) => void | Promise<void>) | undefined;

  /**
   * @param onRolesChanged called after a role's permission set changes or a
   *   role is deleted — every holder's cached permissions are now stale and
   *   must be flushed (wired to the authorization cache in the web app).
   */
  constructor(
    prisma: PrismaClient,
    onRolesChanged?: (organizationId: string) => void | Promise<void>,
  ) {
    this.prisma = prisma;
    this.audit = new AuditService(prisma);
    this.onRolesChanged = onRolesChanged;
  }

  private async notifyRolesChanged(organizationId: string): Promise<void> {
    try {
      await this.onRolesChanged?.(organizationId);
    } catch (error) {
      console.error('Permission cache invalidation failed:', error);
    }
  }

  /** All roles of the active organization (templates + custom). */
  async listRoles(organizationId: string): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId },
      include: {
        permissions: { include: { permission: true } },
        memberRoles: { select: { organizationMemberId: true } },
      },
      orderBy: [{ isTemplate: "desc" }, { isSystem: "desc" }, { name: "asc" }],
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      isTemplate: r.isTemplate,
      singleOrg: isSingleOrgRole(r.slug),
      permissions: r.permissions.map((rp) => rp.permission.key),
      memberCount: new Set(r.memberRoles.map((mr) => mr.organizationMemberId)).size,
    }));
  }

  /** Global permission catalog (matrix source). */
  async listPermissionCatalog() {
    return this.prisma.permission.findMany({
      orderBy: [{ key: "asc" }],
      select: { id: true, key: true, name: true, description: true, scope: true },
    });
  }

  /** Create a custom (non-template) role with a permission replace-set. */
  async createRole(
    actor: ActorContext,
    input: { name: string; slug: string; description?: string; permissions: string[] },
  ): Promise<RoleView> {
    const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    if (!input.name.trim() || !slug) {
      throw new AccessError(400, "Name and slug are required");
    }

    await this.assertPermissionsWithinHoldings(actor, input.permissions);

    const existing = await this.prisma.role.findFirst({
      where: { organizationId: actor.organizationId, slug },
    });
    if (existing) {
      throw new AccessError(409, `A role with slug "${slug}" already exists`);
    }

    const role = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.role.create({
          data: {
            organizationId: actor.organizationId,
            name: input.name.trim(),
            slug,
            description: input.description,
            isSystem: false,
            isTemplate: false,
          },
        });
        await this.replacePermissions(tx, created.id, input.permissions);
        return created;
      },
      { timeout: 30_000 },
    );

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "role.create",
      resourceType: "role",
      resourceId: role.id,
      metadata: { slug, permissions: input.permissions },
    });

    return this.toView(role.id);
  }

  /**
   * Update a role. Custom roles: name/description/permissions. Template
   * roles: permissions only. System roles: read-only.
   */
  async updateRole(
    actor: ActorContext,
    roleId: string,
    input: { name?: string; description?: string; permissions?: string[] },
  ): Promise<RoleView> {
    const role = await this.getScopedRole(actor.organizationId, roleId);

    if (role.isSystem) {
      throw new AccessError(403, "System roles are read-only");
    }

    if (input.permissions) {
      await this.assertPermissionsWithinHoldings(actor, input.permissions);
    }

    await this.prisma.$transaction(
      async (tx) => {
        const data: Record<string, unknown> = {};
        if (!role.isTemplate) {
          if (input.name !== undefined) data.name = input.name.trim();
          if (input.description !== undefined) data.description = input.description;
        } else if (input.name !== undefined || input.description !== undefined) {
          // Template names/descriptions are fixed by the kind matrix
          if (input.name && input.name.trim() !== role.name) {
            throw new AccessError(403, "Template role names cannot be changed");
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.role.update({ where: { id: role.id }, data });
        }
        if (input.permissions) {
          await this.replacePermissions(tx, role.id, input.permissions);
        }
      },
      { timeout: 30_000 },
    );

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "role.update",
      resourceType: "role",
      resourceId: role.id,
      metadata: { permissions: input.permissions },
    });

    // Permission replace-set changed — every holder's cache is stale.
    await this.notifyRolesChanged(actor.organizationId);

    return this.toView(role.id);
  }

  /** Delete a custom role. Template/system roles are never deletable. */
  async deleteRole(actor: ActorContext, roleId: string): Promise<void> {
    const role = await this.getScopedRole(actor.organizationId, roleId);

    if (role.isSystem || role.isTemplate) {
      throw new AccessError(403, "Only custom roles can be deleted");
    }

    const assigned = await this.prisma.organizationMemberRole.count({
      where: { roleId: role.id },
    });
    if (assigned > 0) {
      throw new AccessError(409, `Role is assigned to ${assigned} member(s); reassign them first`);
    }

    await this.prisma.role.delete({ where: { id: role.id } });

    await this.audit.log({
      actorUserId: actor.userId,
      organizationId: actor.organizationId,
      action: "role.delete",
      resourceType: "role",
      resourceId: role.id,
      metadata: { slug: role.slug },
    });

    await this.notifyRolesChanged(actor.organizationId);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async getScopedRole(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });
    if (!role) {
      throw new AccessError(404, "Role not found");
    }
    return role;
  }

  /** The actor may only grant permissions they themselves hold. */
  private async assertPermissionsWithinHoldings(actor: ActorContext, permissions: string[]) {
    const holdings = await this.prisma.rolePermission.findMany({
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
    const held = new Set(holdings.map((h) => h.permission.key));
    const missing = permissions.filter((p) => !held.has(p));
    if (missing.length > 0) {
      throw new AccessError(403, `Cannot grant permissions you do not hold: ${missing.join(", ")}`);
    }
  }

  private async replacePermissions(
    tx: TxClient,
    roleId: string,
    permissions: string[],
  ) {
    const unique = [...new Set(permissions)];
    const rows = await tx.permission.findMany({
      where: { key: { in: unique } },
      select: { id: true, key: true },
    });
    const found = new Set(rows.map((r) => r.key));
    const unknown = unique.filter((k) => !found.has(k));
    if (unknown.length > 0) {
      throw new AccessError(400, `Unknown permissions: ${unknown.join(", ")}`);
    }
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (rows.length > 0) {
      await tx.rolePermission.createMany({
        data: rows.map((r) => ({ roleId, permissionId: r.id })),
        skipDuplicates: true,
      });
    }
  }

  private async toView(roleId: string): Promise<RoleView> {
    const r = await this.prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        memberRoles: { select: { organizationMemberId: true } },
      },
    });
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      isTemplate: r.isTemplate,
      singleOrg: isSingleOrgRole(r.slug),
      permissions: r.permissions.map((rp) => rp.permission.key),
      memberCount: new Set(r.memberRoles.map((mr) => mr.organizationMemberId)).size,
    };
  }
}
