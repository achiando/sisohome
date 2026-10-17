/**
 * Organization kind role templates (BUILD.md §1.1)
 *
 * Every organization is created with a `kind`. On creation, that kind's
 * template roles are seeded as org-scoped roles (organizationId = org.id,
 * isTemplate = true, non-deletable) with RolePermission rows resolved from
 * the global permission catalog.
 *
 * Phase 2 ENRICHES the same roles with domain keys (property.*, lease.*,
 * work_order.*, payment.*) — no renames, no new tables, no re-platforming.
 *
 * Idempotent per organization: upserts roles and skips permission rows that
 * already exist, so re-running never duplicates and never clobbers owner
 * edits to template permissions.
 */

export type OrganizationKindValue =
  | "LANDLORD"
  | "PROPERTY_MANAGEMENT"
  | "MAINTENANCE_COMPANY"
  | "MARKETING_AGENT";

/** Structural subset of the Prisma client this module needs (works with both the generated client and the legacy extension client). */
export interface SeedDb {
  permission: {
    findMany: (args: { select: { id: true; key: true } }) => Promise<Array<{ id: string; key: string }>>;
  };
  role: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
  rolePermission: {
    upsert: (args: unknown) => Promise<unknown>;
    createMany: (args: { data: Array<{ roleId: string; permissionId: string }>; skipDuplicates: boolean }) => Promise<unknown>;
  };
  $executeRawUnsafe: (query: string) => Promise<unknown>;
}

export interface KindTemplateRole {
  slug: string;
  name: string;
  description: string;
  /** Global permission keys (must exist in the Permission catalog). */
  permissions: string[];
}

const OWNER_PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.manage",
  "organization.list",
  "user.create",
  "user.read",
  "user.update",
  "user.delete",
  "user.manage",
  "user.list",
  "membership.invite",
  "membership.remove",
  "membership.manage",
  "membership.view",
  "role.create",
  "role.read",
  "role.update",
  "role.delete",
  "role.assign",
  "role.revoke",
  "role.manage",
  "permission.read",
  "permission.manage",
  "audit.read",
  "audit.export",
  "resource.create",
  "resource.read",
  "resource.update",
  "resource.delete",
  "resource.manage",
  "resource.list",
] as const;

const ADMIN_PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.manage",
  "organization.list",
  "user.create",
  "user.read",
  "user.update",
  "user.delete",
  "user.list",
  "membership.invite",
  "membership.remove",
  "membership.manage",
  "membership.view",
  "role.create",
  "role.read",
  "role.update",
  "role.assign",
  "role.revoke",
  "permission.read",
  "audit.read",
  "resource.create",
  "resource.read",
  "resource.update",
  "resource.delete",
  "resource.manage",
  "resource.list",
] as const;

const VIEWER_PERMISSIONS = [
  "organization.read",
  "user.read",
  "membership.view",
  "resource.read",
  "resource.list",
] as const;

export const KIND_TEMPLATE_ROLES: Record<OrganizationKindValue, KindTemplateRole[]> = {
  LANDLORD: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the landlord workspace",
      permissions: [...OWNER_PERMISSIONS],
    },
    {
      slug: "manager",
      name: "Manager",
      description: "Day-to-day operations and light member management",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "user.update",
        "user.list",
        "membership.invite",
        "membership.view",
        "role.read",
        "resource.create",
        "resource.read",
        "resource.update",
        "resource.list",
        "audit.read",
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access (e.g. accountant, family member)",
      permissions: [...VIEWER_PERMISSIONS],
    },
  ],

  PROPERTY_MANAGEMENT: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the company workspace",
      permissions: [...OWNER_PERMISSIONS],
    },
    {
      slug: "admin",
      name: "Administrator",
      description: "Company administration: members, roles, org settings",
      permissions: [...ADMIN_PERMISSIONS],
    },
    {
      slug: "property_manager",
      name: "Property Manager",
      description: "Operational manager of assigned properties",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "user.update",
        "user.list",
        "membership.invite",
        "membership.view",
        "role.read",
        "resource.create",
        "resource.read",
        "resource.update",
        "resource.list",
        "audit.read",
      ],
    },
    {
      slug: "finance_officer",
      name: "Finance Officer",
      description: "Records and reconciles payments, rent ledgers",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "resource.read",
        "resource.update",
        "resource.list",
        "audit.read",
        "audit.export",
      ],
    },
    {
      slug: "finance_approver",
      name: "Finance Approver",
      description: "Approves expenses and adjustments (separate from submitting)",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "resource.read",
        "resource.list",
        "audit.read",
      ],
    },
    {
      slug: "leasing_officer",
      name: "Leasing Officer",
      description: "Tenant onboarding, leases, rental agreements",
      permissions: [
        "organization.read",
        "organization.list",
        "user.create",
        "user.read",
        "user.update",
        "user.list",
        "membership.invite",
        "resource.create",
        "resource.read",
        "resource.update",
        "resource.list",
      ],
    },
    {
      slug: "caretaker",
      name: "Caretaker",
      description: "Site supervisor: inspections and issue reporting",
      permissions: ["organization.read", "resource.read", "resource.list"],
    },
    {
      slug: "maintenance_coordinator",
      name: "Maintenance Coordinator",
      description: "Coordinates maintenance jobs and technicians",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "resource.read",
        "resource.update",
        "resource.list",
        "audit.read",
      ],
    },
    {
      slug: "member",
      name: "Member",
      description: "Standard staff access",
      permissions: ["organization.read", "user.read", "membership.view", "resource.read", "resource.list"],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [...VIEWER_PERMISSIONS],
    },
  ],

  MAINTENANCE_COMPANY: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the company workspace",
      permissions: [...OWNER_PERMISSIONS],
    },
    {
      slug: "admin",
      name: "Administrator",
      description: "Company administration: members, roles, org settings",
      permissions: [...ADMIN_PERMISSIONS],
    },
    {
      slug: "coordinator",
      name: "Coordinator",
      description: "Manages jobs, schedules and technicians",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "user.update",
        "user.list",
        "membership.invite",
        "membership.view",
        "role.read",
        "resource.create",
        "resource.read",
        "resource.update",
        "resource.list",
      ],
    },
    {
      slug: "technician",
      name: "Technician",
      description: "Field technician with read/list access (Phase 2 scopes to assigned jobs)",
      permissions: ["organization.read", "resource.read", "resource.list"],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [...VIEWER_PERMISSIONS],
    },
  ],

  /**
   * House-marketing individual: their work is marketing homes and capturing
   * tenant leads, which they hand off to a landlord or property-management
   * org — no property ops, finance, or maintenance. Phase 2 enriches
   * `marketing_agent` with the cross-org handoff domain keys (listing.*,
   * lead.*, handoff.create).
   */
  MARKETING_AGENT: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the marketing workspace",
      permissions: [...OWNER_PERMISSIONS],
    },
    {
      slug: "marketing_agent",
      name: "Marketing Agent",
      description:
        "Markets properties and captures tenant leads, handing them off to landlords or management",
      permissions: [
        "organization.read",
        "organization.list",
        "user.read",
        "user.update",
        "user.list",
        "membership.invite",
        "membership.view",
        "role.read",
        "resource.create",
        "resource.read",
        "resource.update",
        "resource.list",
        "audit.read",
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [...VIEWER_PERMISSIONS],
    },
  ],
};

/**
 * Seeds the kind's template roles for one organization. Idempotent:
 * safe to re-run; existing permission edits by the owner are preserved.
 */
export async function seedOrgKindRoles(
  client: SeedDb,
  organizationId: string,
  kind: OrganizationKindValue,
): Promise<void> {
  const templateRoles = KIND_TEMPLATE_ROLES[kind];
  if (!templateRoles) {
    throw new Error(`Unknown organization kind: ${kind}`);
  }

  const permissions = await client.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const missingKeys = templateRoles
    .flatMap((r) => r.permissions)
    .filter((key) => !permissionIdByKey.has(key));
  if (missingKeys.length > 0) {
    throw new Error(
      `Kind ${kind} references permissions missing from the catalog: ${[...new Set(missingKeys)].join(", ")}. Run the foundation seed first.`,
    );
  }

  for (const template of templateRoles) {
    const role = await client.role.upsert({
      where: {
        organizationId_slug: { organizationId, slug: template.slug },
      },
      update: {},
      create: {
        organizationId,
        name: template.name,
        slug: template.slug,
        description: template.description,
        isSystem: false,
        isTemplate: true,
      },
    });

    // Batch insert; skipDuplicates keeps re-runs idempotent without clobbering
    // any permission edits the owner has made to this template.
    const rows = template.permissions.map((key) => ({
      roleId: role.id,
      permissionId: permissionIdByKey.get(key)!,
    }));
    if (rows.length > 0) {
      await client.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }
}

/**
 * Ensures the partial unique index on global role slugs exists
 * (Postgres treats NULLs as distinct, so the compound unique does not
 * cover system roles). Safe to run repeatedly.
 */
export async function ensureGlobalRoleSlugIndex(client: SeedDb): Promise<void> {
  await client.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS roles_global_slug_unique ON roles (slug) WHERE organization_id IS NULL`,
  );
}
