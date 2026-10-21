/**
 * Organization kind role templates (BUILD.md §1.1)
 *
 * Every organization is created with a `kind`. On creation, that kind's
 * template roles are seeded as org-scoped roles (organizationId = org.id,
 * isTemplate = true, non-deletable) with RolePermission rows resolved from
 * the global permission catalog.
 *
 * Phase 2 ENRICHES the same roles with domain keys — no renames, no new
 * tables, no re-platforming. Batches 1–5: property/unit/ownership/agreement/
 * document (b1), tenant/lease (b2), applications & ledger (b3), operations
 * (b4), marketing & sales (b5), per research-property-1.md §2.
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

// ── Phase 2, batch 1: property-domain key groups (research-property-1 §2) ──
const PROPERTY_KEYS = [
  "property.create",
  "property.read",
  "property.list",
  "property.update",
  "property.delete",
  "property.archive",
  "property.manage",
] as const;

const UNIT_KEYS = [
  "unit.create",
  "unit.read",
  "unit.list",
  "unit.update",
  "unit.delete",
  "unit.manage",
] as const;

const OWNERSHIP_KEYS = [
  "ownership.read",
  "ownership.list",
  "ownership.create",
  "ownership.update",
] as const;

const AGREEMENT_KEYS = [
  "agreement.read",
  "agreement.list",
  "agreement.create",
  "agreement.update",
  "agreement.approve",
] as const;

const DOCUMENT_KEYS = [
  "document.upload",
  "document.read",
  "document.list",
  "document.update",
  "document.delete",
] as const;

/**
 * Every property-family key. Each kind's `owner` template gets exactly this
 * set — the matrix test asserts the owner sets are identical across kinds.
 */
const OWNER_PROPERTY_KEYS = [
  ...PROPERTY_KEYS,
  ...UNIT_KEYS,
  ...OWNERSHIP_KEYS,
  ...AGREEMENT_KEYS,
  ...DOCUMENT_KEYS,
];

const PROPERTY_READ = ["property.read", "property.list"] as const;
const UNIT_READ = ["unit.read", "unit.list"] as const;
const OWNERSHIP_READ = ["ownership.read", "ownership.list"] as const;
const AGREEMENT_READ = ["agreement.read", "agreement.list"] as const;
const DOCUMENT_READ = ["document.read", "document.list"] as const;
const DOCUMENT_UPLOAD = ["document.upload", "document.update"] as const;
const DOCUMENT_UPLOAD_READ = [
  "document.upload",
  "document.update",
  "document.read",
  "document.list",
] as const;

/** Property: create/read/list/update/archive — no delete, no manage. */
const PROPERTY_EDIT = [
  "property.create",
  "property.read",
  "property.list",
  "property.update",
  "property.archive",
] as const;

/** Units: create/read/list/update — no delete, no manage. */
const UNIT_EDIT = ["unit.create", "unit.read", "unit.list", "unit.update"] as const;

/** Agreements: read/list/create/update — approve stays with the owner. */
const AGREEMENT_EDIT = [
  "agreement.read",
  "agreement.list",
  "agreement.create",
  "agreement.update",
] as const;

// ── Phase 2, batch 2: tenancy key groups (research-property-1 §1.2, §2) ──
const TENANT_KEYS = [
  "tenant.create",
  "tenant.read",
  "tenant.list",
  "tenant.update",
  "tenant.delete",
  "tenant.manage",
] as const;

const LEASE_KEYS = [
  "lease.create",
  "lease.read",
  "lease.list",
  "lease.update",
  "lease.approve",
  "lease.manage",
] as const;

/**
 * Every tenancy key — part of each kind's identical `owner` set (the matrix
 * test requires owner templates to be identical across LANDLORD/PM/MM; a
 * maintenance org's owner holds the keys but reaches zero rows without a
 * portfolio/agreement relationship).
 */
const OWNER_TENANCY_KEYS = [...TENANT_KEYS, ...LEASE_KEYS];

const TENANT_READ = ["tenant.read", "tenant.list"] as const;
const LEASE_READ = ["lease.read", "lease.list"] as const;
/** Tenant: create/read/list/update — no delete. */
const TENANT_EDIT = [
  "tenant.create",
  "tenant.read",
  "tenant.list",
  "tenant.update",
] as const;
/** Lease: create/read/list/update/approve — no manage (owner renews/terminates/closes). */
const LEASE_EDIT = [
  "lease.create",
  "lease.read",
  "lease.list",
  "lease.update",
  "lease.approve",
] as const;

// ── Phase 2, batch 3: applications & ledger (research-property-1 §1.3, §2) ──
const APPLICATION_KEYS = [
  "application.create",
  "application.read",
  "application.list",
  "application.update",
  "application.approve",
] as const;

const CHARGE_KEYS = [
  "charge.create",
  "charge.read",
  "charge.list",
  "charge.update",
  "charge.manage",
  "charge.approve",
] as const;

const PAYMENT_KEYS = [
  "payment.create",
  "payment.read",
  "payment.list",
  "payment.update",
  "payment.manage",
] as const;

const EXPENSE_KEYS = [
  "expense.create",
  "expense.read",
  "expense.list",
  "expense.update",
  "expense.approve",
] as const;

const ADJUSTMENT_KEYS = [
  "adjustment.create",
  "adjustment.read",
  "adjustment.list",
  "adjustment.approve",
] as const;

const STATEMENT_KEYS = ["statement.read"] as const;
const RECEIPT_KEYS = ["receipt.issue"] as const;

/**
 * Every applications/ledger key — part of each kind's identical `owner` set.
 * Statement keys are read-only everywhere, so viewers may hold statement.read.
 */
const OWNER_LEDGER_KEYS = [
  ...APPLICATION_KEYS,
  ...CHARGE_KEYS,
  ...PAYMENT_KEYS,
  ...EXPENSE_KEYS,
  ...ADJUSTMENT_KEYS,
  ...STATEMENT_KEYS,
  ...RECEIPT_KEYS,
];

// ── Phase 2, batch 4: operations (research-property-1 §1.4, §2) ────────────
const MAINTENANCE_KEYS = [
  "maintenance.create",
  "maintenance.read",
  "maintenance.list",
  "maintenance.update",
  "maintenance.manage",
] as const;

const WORK_ORDER_KEYS = [
  "work_order.create",
  "work_order.read",
  "work_order.list",
  "work_order.update",
  "work_order.manage",
  "work_order.assign",
] as const;

const INSPECTION_KEYS = [
  "inspection.create",
  "inspection.read",
  "inspection.list",
  "inspection.update",
] as const;

const SCHEDULE_KEYS = [
  "schedule.create",
  "schedule.read",
  "schedule.list",
  "schedule.update",
] as const;

const OWNER_OPS_KEYS = [
  ...MAINTENANCE_KEYS,
  ...WORK_ORDER_KEYS,
  ...INSPECTION_KEYS,
  ...SCHEDULE_KEYS,
];

// ── Phase 2, batch 5: marketing & sales (research-property-4, §2 matrix) ───
const LISTING_KEYS = [
  "listing.create",
  "listing.read",
  "listing.list",
  "listing.update",
  "listing.publish",
  "listing.manage",
] as const;

const LEAD_KEYS = [
  "lead.create",
  "lead.read",
  "lead.list",
  "lead.update",
  "lead.manage",
] as const;

const VIEWING_KEYS = [
  "viewing.create",
  "viewing.read",
  "viewing.list",
  "viewing.update",
] as const;

const OFFER_KEYS = [
  "offer.create",
  "offer.read",
  "offer.list",
  "offer.update",
  "offer.approve",
] as const;

const HANDOFF_KEYS = ["handoff.create"] as const;

const OWNER_SALES_KEYS = [
  ...LISTING_KEYS,
  ...LEAD_KEYS,
  ...VIEWING_KEYS,
  ...OFFER_KEYS,
  ...HANDOFF_KEYS,
];

/**
 * Every Phase-2 domain key. LANDLORD/PM/MM `owner` templates get exactly this
 * set on top of OWNER_PERMISSIONS — the matrix test asserts the three owner
 * sets are identical. MARKETING_AGENT.owner is intentionally different
 * (sales keys only, no ops/finance/tenancy — matrix §2.4).
 */
const OWNER_DOMAIN_KEYS = [
  ...OWNER_PROPERTY_KEYS,
  ...OWNER_TENANCY_KEYS,
  ...OWNER_LEDGER_KEYS,
  ...OWNER_OPS_KEYS,
  ...OWNER_SALES_KEYS,
];

// Read helper groups (read+list — viewer-safe suffixes).
const APPLICATION_READ = ["application.read", "application.list"] as const;
const CHARGE_READ = ["charge.read", "charge.list"] as const;
const PAYMENT_READ = ["payment.read", "payment.list"] as const;
const EXPENSE_READ = ["expense.read", "expense.list"] as const;
const ADJUSTMENT_READ = ["adjustment.read", "adjustment.list"] as const;
const STATEMENT_READ = ["statement.read"] as const;
const MAINTENANCE_READ = ["maintenance.read", "maintenance.list"] as const;
const WORK_ORDER_READ = ["work_order.read", "work_order.list"] as const;
const INSPECTION_READ = ["inspection.read", "inspection.list"] as const;
const SCHEDULE_READ = ["schedule.read", "schedule.list"] as const;
const LISTING_READ = ["listing.read", "listing.list"] as const;
const LEAD_READ = ["lead.read", "lead.list"] as const;
const VIEWING_READ = ["viewing.read", "viewing.list"] as const;
const OFFER_READ = ["offer.read", "offer.list"] as const;

// Operational edit sets used by matrix §2 rows.
/** Application: no create (leasing_officer creates); read/list/update/decide. */
const APPLICATION_EDIT = [
  "application.read",
  "application.list",
  "application.update",
  "application.approve",
] as const;
/** Charges: create/read/list — no update, no post (property_manager posts). */
const CHARGE_BASIC = ["charge.create", "charge.read", "charge.list"] as const;
/** Charges: finance officer — create/read/list/update/approve(post); no manage. */
const CHARGE_FINANCE = [
  "charge.create",
  "charge.read",
  "charge.list",
  "charge.update",
  "charge.approve",
] as const;
/** Payments: create/read/list — no update, no manage. */
const PAYMENT_BASIC = ["payment.create", "payment.read", "payment.list"] as const;
/** Payments: finance officer — no manage. */
const PAYMENT_FINANCE = [
  "payment.create",
  "payment.read",
  "payment.list",
  "payment.update",
] as const;
/** Maintenance: create/read/list/update — no manage (owner cancels/closes). */
const MAINTENANCE_EDIT = [
  "maintenance.create",
  "maintenance.read",
  "maintenance.list",
  "maintenance.update",
] as const;
/** Work orders: create/read/list/update/assign — no manage. */
const WORK_ORDER_EDIT = [
  "work_order.create",
  "work_order.read",
  "work_order.list",
  "work_order.update",
  "work_order.assign",
] as const;
/** Work orders: read/list/update only (caretaker, technician). */
const WORK_ORDER_UPDATE = [
  "work_order.read",
  "work_order.list",
  "work_order.update",
] as const;
/** Listings: create/read/list/update/publish — no manage. */
const LISTING_EDIT = [
  "listing.create",
  "listing.read",
  "listing.list",
  "listing.update",
  "listing.publish",
] as const;
/** Listings: ops-side update without publish/create (property_manager). */
const LISTING_OPS = ["listing.read", "listing.list", "listing.update"] as const;
/** Leads: full family except a hypothetical delete (landlord manager). */
const LEAD_EDIT = [
  "lead.create",
  "lead.read",
  "lead.list",
  "lead.update",
  "lead.manage",
] as const;
/** Leads: capture set without manage (marketing agent). */
const LEAD_BASIC = ["lead.create", "lead.read", "lead.list", "lead.update"] as const;
/** Leads: ops-side only (property_manager). */
const LEAD_OPS = ["lead.read", "lead.list", "lead.update"] as const;
/** Offers: create/read/list/update — no approve (owner accepts). */
const OFFER_EDIT = [
  "offer.create",
  "offer.read",
  "offer.list",
  "offer.update",
] as const;

export const KIND_TEMPLATE_ROLES: Record<OrganizationKindValue, KindTemplateRole[]> = {
  LANDLORD: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the landlord workspace",
      permissions: [...OWNER_PERMISSIONS, ...OWNER_DOMAIN_KEYS],
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
        ...PROPERTY_EDIT,
        ...UNIT_EDIT,
        ...OWNERSHIP_READ,
        ...AGREEMENT_READ,
        ...DOCUMENT_UPLOAD_READ,
        ...TENANT_EDIT,
        ...LEASE_EDIT,
        ...APPLICATION_EDIT,
        ...CHARGE_BASIC,
        ...PAYMENT_BASIC,
        "expense.create",
        ...RECEIPT_KEYS,
        ...MAINTENANCE_KEYS,
        ...WORK_ORDER_EDIT,
        ...INSPECTION_KEYS,
        ...SCHEDULE_KEYS,
        ...LISTING_EDIT,
        ...LEAD_EDIT,
        ...VIEWING_KEYS,
        ...OFFER_EDIT,
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access (e.g. accountant, family member)",
      permissions: [
        ...VIEWER_PERMISSIONS,
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...OWNERSHIP_READ,
        ...AGREEMENT_READ,
        ...DOCUMENT_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        ...CHARGE_READ,
        ...PAYMENT_READ,
        ...STATEMENT_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
        ...LISTING_READ,
        ...OFFER_READ,
      ],
    },
  ],

  PROPERTY_MANAGEMENT: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the company workspace",
      permissions: [...OWNER_PERMISSIONS, ...OWNER_DOMAIN_KEYS],
    },
    {
      slug: "admin",
      name: "Administrator",
      description: "Company administration: members, roles, org settings",
      permissions: [
        ...ADMIN_PERMISSIONS,
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...OWNERSHIP_READ,
        ...AGREEMENT_READ,
        ...DOCUMENT_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        ...APPLICATION_READ,
        ...CHARGE_READ,
        ...PAYMENT_READ,
        ...EXPENSE_READ,
        ...ADJUSTMENT_READ,
        ...STATEMENT_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
        ...INSPECTION_READ,
        ...SCHEDULE_READ,
        ...LISTING_READ,
        ...LEAD_READ,
        ...VIEWING_READ,
        ...OFFER_READ,
      ],
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
        ...PROPERTY_EDIT,
        ...UNIT_EDIT,
        ...OWNERSHIP_READ,
        ...AGREEMENT_EDIT,
        ...DOCUMENT_UPLOAD_READ,
        ...TENANT_EDIT,
        ...LEASE_EDIT,
        ...APPLICATION_EDIT,
        ...CHARGE_KEYS.filter((k) => k !== "charge.update" && k !== "charge.manage"),
        ...PAYMENT_BASIC,
        "expense.create",
        ...ADJUSTMENT_READ,
        ...STATEMENT_READ,
        ...RECEIPT_KEYS,
        ...MAINTENANCE_KEYS,
        ...WORK_ORDER_EDIT,
        ...INSPECTION_KEYS,
        ...SCHEDULE_KEYS,
        ...LISTING_OPS,
        ...LEAD_OPS,
        ...VIEWING_KEYS,
        ...OFFER_EDIT,
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
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_UPLOAD_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        ...CHARGE_FINANCE,
        ...PAYMENT_FINANCE,
        "expense.create",
        "expense.read",
        "expense.list",
        "expense.update",
        "adjustment.create",
        "adjustment.read",
        "adjustment.list",
        ...STATEMENT_READ,
        ...RECEIPT_KEYS,
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
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        "charge.read",
        "charge.list",
        "charge.approve",
        ...PAYMENT_READ,
        "expense.read",
        "expense.list",
        "expense.approve",
        "adjustment.read",
        "adjustment.approve",
        ...STATEMENT_READ,
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
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_UPLOAD_READ,
        ...TENANT_EDIT,
        ...LEASE_EDIT,
        ...APPLICATION_KEYS,
        ...CHARGE_READ,
        ...LEAD_BASIC,
        ...LISTING_EDIT,
        ...VIEWING_KEYS,
      ],
    },
    {
      slug: "caretaker",
      name: "Caretaker",
      description: "Site supervisor: inspections and issue reporting",
      permissions: [
        "organization.read",
        "resource.read",
        "resource.list",
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_UPLOAD,
        "tenant.read",
        ...MAINTENANCE_EDIT,
        ...WORK_ORDER_UPDATE,
        ...INSPECTION_KEYS,
      ],
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
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_UPLOAD,
        ...MAINTENANCE_EDIT,
        ...WORK_ORDER_EDIT,
        ...INSPECTION_READ,
        ...SCHEDULE_KEYS,
        ...LISTING_READ,
      ],
    },
    {
      slug: "member",
      name: "Member",
      description: "Standard staff access",
      permissions: [
        "organization.read",
        "user.read",
        "membership.view",
        "resource.read",
        "resource.list",
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [
        ...VIEWER_PERMISSIONS,
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_READ,
        ...TENANT_READ,
        ...LEASE_READ,
        ...CHARGE_READ,
        ...PAYMENT_READ,
        ...STATEMENT_READ,
        ...EXPENSE_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
      ],
    },
  ],

  MAINTENANCE_COMPANY: [
    {
      slug: "owner",
      name: "Owner",
      description: "Full control of the company workspace",
      permissions: [...OWNER_PERMISSIONS, ...OWNER_DOMAIN_KEYS],
    },
    {
      slug: "admin",
      name: "Administrator",
      description: "Company administration: members, roles, org settings",
      permissions: [
        ...ADMIN_PERMISSIONS,
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
        ...INSPECTION_READ,
        ...SCHEDULE_READ,
      ],
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
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_UPLOAD,
        ...MAINTENANCE_KEYS,
        ...WORK_ORDER_KEYS,
        ...INSPECTION_KEYS,
        ...SCHEDULE_KEYS,
      ],
    },
    {
      slug: "technician",
      name: "Technician",
      description: "Field technician with read/list access (Phase 2 scopes to assigned jobs)",
      permissions: [
        "organization.read",
        "resource.read",
        "resource.list",
        "property.read",
        "unit.read",
        ...WORK_ORDER_UPDATE,
        ...INSPECTION_KEYS,
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [
        ...VIEWER_PERMISSIONS,
        ...PROPERTY_READ,
        ...UNIT_READ,
        ...DOCUMENT_READ,
        ...MAINTENANCE_READ,
        ...WORK_ORDER_READ,
        ...INSPECTION_READ,
      ],
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
      // Marketing orgs own property listings/marketing records and their
      // documents — but never unit/ownership/agreement operations (matrix §2.4).
      permissions: [
        ...OWNER_PERMISSIONS,
        ...PROPERTY_KEYS,
        ...DOCUMENT_KEYS,
        ...LISTING_KEYS,
        ...LEAD_KEYS,
        ...VIEWING_KEYS,
        ...OFFER_KEYS,
        ...HANDOFF_KEYS,
      ],
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
        ...PROPERTY_READ,
        ...DOCUMENT_UPLOAD,
        ...LISTING_EDIT,
        ...LEAD_BASIC,
        ...VIEWING_KEYS,
        ...HANDOFF_KEYS,
      ],
    },
    {
      slug: "viewer",
      name: "Viewer",
      description: "Read-only access",
      permissions: [
        ...VIEWER_PERMISSIONS,
        ...PROPERTY_READ,
        ...DOCUMENT_READ,
        ...LISTING_READ,
        ...LEAD_READ,
      ],
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
