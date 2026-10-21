/**
 * Foundation permission catalog.
 * Phase 1: keys below under the FOUNDATION section.
 * Phase 2 (batch 1): property-domain keys (property.*, unit.*, ownership.*,
 * agreement.*, document.*) — appended in the PROPERTY DOMAIN section.
 * Phase 2 (batch 2): tenancy keys (tenant.*, lease.*).
 * Phase 2 (batches 3–5): applications/ledger, operations, marketing/sales —
 * appended at the end so earlier key order stays untouched (no renames).
 */

export const FOUNDATION_PERMISSIONS = [
  // Organization permissions
  { key: 'organization.create', name: 'Create Organization', description: 'Create new organizations' },
  { key: 'organization.read', name: 'View Organization', description: 'View organization details' },
  { key: 'organization.update', name: 'Update Organization', description: 'Update organization information' },
  { key: 'organization.delete', name: 'Delete Organization', description: 'Delete organizations' },
  { key: 'organization.manage', name: 'Manage Organization', description: 'Full organization management' },
  { key: 'organization.list', name: 'List Organizations', description: 'List organizations' },

  // User permissions
  { key: 'user.create', name: 'Create User', description: 'Create new users' },
  { key: 'user.read', name: 'View User', description: 'View user information' },
  { key: 'user.update', name: 'Update User', description: 'Update user information' },
  { key: 'user.delete', name: 'Delete User', description: 'Delete users' },
  { key: 'user.manage', name: 'Manage User', description: 'Full user management' },
  { key: 'user.list', name: 'List Users', description: 'List users' },

  // Membership permissions
  { key: 'membership.invite', name: 'Invite Member', description: 'Invite users to organization' },
  { key: 'membership.remove', name: 'Remove Member', description: 'Remove members from organization' },
  { key: 'membership.manage', name: 'Manage Membership', description: 'Full membership management' },
  { key: 'membership.view', name: 'View Membership', description: 'View membership information' },

  // Role permissions
  { key: 'role.create', name: 'Create Role', description: 'Create new roles' },
  { key: 'role.read', name: 'View Role', description: 'View role information' },
  { key: 'role.update', name: 'Update Role', description: 'Update role information' },
  { key: 'role.delete', name: 'Delete Role', description: 'Delete roles' },
  { key: 'role.assign', name: 'Assign Role', description: 'Assign roles to members' },
  { key: 'role.revoke', name: 'Revoke Role', description: 'Revoke roles from members' },
  { key: 'role.manage', name: 'Manage Role', description: 'Full role management' },

  // Permission permissions
  { key: 'permission.create', name: 'Create Permission', description: 'Create new permissions' },
  { key: 'permission.read', name: 'View Permission', description: 'View permission information' },
  { key: 'permission.update', name: 'Update Permission', description: 'Update permission information' },
  { key: 'permission.delete', name: 'Delete Permission', description: 'Delete permissions' },
  { key: 'permission.assign', name: 'Assign Permission', description: 'Assign permissions to roles' },
  { key: 'permission.manage', name: 'Manage Permission', description: 'Full permission management' },

  // Resource relationship permissions
  { key: 'relationship.create', name: 'Create Relationship', description: 'Create resource relationships' },
  { key: 'relationship.read', name: 'View Relationship', description: 'View resource relationships' },
  { key: 'relationship.update', name: 'Update Relationship', description: 'Update resource relationships' },
  { key: 'relationship.delete', name: 'Delete Relationship', description: 'Delete resource relationships' },
  { key: 'relationship.manage', name: 'Manage Relationship', description: 'Full relationship management' },

  // Audit permissions
  { key: 'audit.read', name: 'View Audit Logs', description: 'View audit log entries' },
  { key: 'audit.export', name: 'Export Audit Logs', description: 'Export audit log data' },

  // Platform permissions
  { key: 'platform.admin', name: 'Platform Admin', description: 'Full platform administration' },
  { key: 'platform.view', name: 'Platform View', description: 'View platform-wide information' },
  { key: 'platform.manage', name: 'Platform Manage', description: 'Platform management capabilities' },

  // Generic resource permissions (for future domains)
  { key: 'resource.create', name: 'Create Resource', description: 'Create generic resources' },
  { key: 'resource.read', name: 'View Resource', description: 'View generic resources' },
  { key: 'resource.update', name: 'Update Resource', description: 'Update generic resources' },
  { key: 'resource.delete', name: 'Delete Resource', description: 'Delete generic resources' },
  { key: 'resource.manage', name: 'Manage Resource', description: 'Full resource management' },
  { key: 'resource.list', name: 'List Resources', description: 'List generic resources' },

  // ── Phase 2, batch 1 — property & physical structure (research-property-1 §1.1) ──
  { key: 'property.create', name: 'Create Property', description: 'Add a property record' },
  { key: 'property.read', name: 'View Property', description: 'Open property detail' },
  { key: 'property.list', name: 'List Properties', description: 'Portfolio listing/grid/map' },
  { key: 'property.update', name: 'Update Property', description: 'Edit property details, media and defaults' },
  { key: 'property.delete', name: 'Delete Property', description: 'Remove draft properties only' },
  { key: 'property.archive', name: 'Archive Property', description: 'Retire from the active portfolio (keeps history)' },
  { key: 'property.manage', name: 'Manage Property', description: 'Full property control' },
  { key: 'unit.create', name: 'Create Unit', description: 'Add units, buildings and unit types' },
  { key: 'unit.read', name: 'View Unit', description: 'Open unit record' },
  { key: 'unit.list', name: 'List Units', description: 'Unit grid/floor plan listing' },
  { key: 'unit.update', name: 'Update Unit', description: 'Edit unit details and defaults' },
  { key: 'unit.delete', name: 'Delete Unit', description: 'Remove unit record' },
  { key: 'unit.manage', name: 'Manage Unit', description: 'Full unit control' },

  // ── Phase 2, batch 1 — ownership & management agreements ────────────────
  { key: 'ownership.read', name: 'View Ownership', description: 'View owner parties, shares and effective dates' },
  { key: 'ownership.list', name: 'List Ownership', description: 'List ownership records for a property or unit' },
  { key: 'ownership.create', name: 'Create Ownership', description: 'Record an owner party and share' },
  { key: 'ownership.update', name: 'Update Ownership', description: 'Edit ownership shares and effective dates' },
  { key: 'agreement.read', name: 'View Management Agreement', description: 'Open a property management agreement' },
  { key: 'agreement.list', name: 'List Management Agreements', description: 'List management agreements' },
  { key: 'agreement.create', name: 'Create Management Agreement', description: 'Draft an owner-to-manager agreement' },
  { key: 'agreement.update', name: 'Update Management Agreement', description: 'Edit agreement terms, dates and scope' },
  { key: 'agreement.approve', name: 'Approve Management Agreement', description: 'Activate a signed management agreement' },

  // ── Phase 2, batch 1 — property documents & media ───────────────────────
  { key: 'document.upload', name: 'Upload Documents', description: 'Upload property, unit and agreement files (incl. photo evidence)' },
  { key: 'document.read', name: 'View Documents', description: 'Open property documents and media' },
  { key: 'document.list', name: 'List Documents', description: "List a property's documents and gallery" },
  { key: 'document.update', name: 'Update Documents', description: 'Edit captions, gallery cover and sort order' },
  { key: 'document.delete', name: 'Delete Documents', description: 'Remove uploaded property documents' },

  // ── Phase 2, batch 2 — tenancy: tenants & leases (research-property-1 §1.2) ──
  { key: 'tenant.create', name: 'Create Tenant', description: 'Add a tenant party record' },
  { key: 'tenant.read', name: 'View Tenant', description: 'Open PII-gated tenant profile' },
  { key: 'tenant.list', name: 'List Tenants', description: 'Tenant directory' },
  { key: 'tenant.update', name: 'Update Tenant', description: 'Edit tenant details' },
  { key: 'tenant.delete', name: 'Delete Tenant', description: 'Remove a tenant that has no leases' },
  { key: 'tenant.manage', name: 'Manage Tenant', description: 'Full tenant control (incl. portal invite state)' },
  { key: 'lease.create', name: 'Create Lease', description: 'Draft a lease' },
  { key: 'lease.read', name: 'View Lease', description: 'Open lease and terms' },
  { key: 'lease.list', name: 'List Leases', description: 'Lease register' },
  { key: 'lease.update', name: 'Update Lease', description: 'Edit draft/active lease terms (amendment)' },
  { key: 'lease.approve', name: 'Approve Lease', description: 'Move pending → scheduled/active (sign-off)' },
  { key: 'lease.manage', name: 'Manage Lease', description: 'Full lease lifecycle (renew, terminate, close)' },

  // ── Phase 2, batch 3 — applications & ledger (research-property-1 §1.3) ──
  { key: 'application.create', name: 'Create Rental Application', description: 'Capture a rental application' },
  { key: 'application.read', name: 'View Rental Application', description: 'Open application and screening summary' },
  { key: 'application.list', name: 'List Rental Applications', description: 'Application/screening queue' },
  { key: 'application.update', name: 'Update Rental Application', description: 'Edit application state and notes' },
  { key: 'application.approve', name: 'Decide Rental Application', description: 'Approve or reject an application' },
  { key: 'charge.create', name: 'Create Charge', description: 'Add a one-off charge to the ledger' },
  { key: 'charge.read', name: 'View Charge', description: 'Open a charge and its source trace' },
  { key: 'charge.list', name: 'List Charges', description: 'Charge register' },
  { key: 'charge.update', name: 'Update Charge', description: 'Edit a draft (unposted) charge' },
  { key: 'charge.manage', name: 'Manage Charges', description: 'Full charge control incl. void' },
  { key: 'charge.approve', name: 'Post Charges', description: 'Review and post generated charges to the ledger' },
  { key: 'payment.create', name: 'Record Payment', description: 'Record a received payment' },
  { key: 'payment.read', name: 'View Payment', description: 'Open payment and allocations' },
  { key: 'payment.list', name: 'List Payments', description: 'Payment register' },
  { key: 'payment.update', name: 'Update Payment', description: 'Edit payment details / reconciliation fields' },
  { key: 'payment.manage', name: 'Manage Payments', description: 'Full payment control incl. reverse' },
  { key: 'expense.create', name: 'Submit Expense', description: 'Submit a property expense' },
  { key: 'expense.read', name: 'View Expense', description: 'Open expense and approval trail' },
  { key: 'expense.list', name: 'List Expenses', description: 'Expense register' },
  { key: 'expense.update', name: 'Update Expense', description: 'Edit a submitted (undecided) expense' },
  { key: 'expense.approve', name: 'Approve Expense', description: 'Separation of duties: approver ≠ submitter' },
  { key: 'adjustment.create', name: 'Create Adjustment', description: 'Submit a credit/waiver/reversal' },
  { key: 'adjustment.read', name: 'View Adjustment', description: 'Open adjustment and decision trail' },
  { key: 'adjustment.list', name: 'List Adjustments', description: 'Adjustments queue' },
  { key: 'adjustment.approve', name: 'Approve Adjustment', description: 'Waivers must be approved separately' },
  { key: 'statement.read', name: 'Read Owner Statements', description: 'Per-owner/property collection statements' },
  { key: 'receipt.issue', name: 'Issue Receipt', description: 'Issue payment evidence' },

  // ── Phase 2, batch 4 — operations: tickets, work orders, inspections ────
  { key: 'maintenance.create', name: 'Report Maintenance', description: 'Create a maintenance ticket' },
  { key: 'maintenance.read', name: 'View Maintenance Ticket', description: 'Open ticket detail' },
  { key: 'maintenance.list', name: 'List Maintenance Tickets', description: 'Ticket board/queue' },
  { key: 'maintenance.update', name: 'Update Maintenance Ticket', description: 'Edit ticket state and notes' },
  { key: 'maintenance.manage', name: 'Manage Maintenance', description: 'Full ticket control incl. cancel/close' },
  { key: 'work_order.create', name: 'Create Work Order', description: 'Authorize a repair job' },
  { key: 'work_order.read', name: 'View Work Order', description: 'Open work order detail' },
  { key: 'work_order.list', name: 'List Work Orders', description: 'Work order register' },
  { key: 'work_order.update', name: 'Update Work Order', description: 'Edit work order state and costs' },
  { key: 'work_order.manage', name: 'Manage Work Orders', description: 'Full work order control incl. cancel' },
  { key: 'work_order.assign', name: 'Assign Work Order', description: 'Hand a job to staff/provider' },
  { key: 'inspection.create', name: 'Create Inspection', description: 'Schedule an inspection' },
  { key: 'inspection.read', name: 'View Inspection', description: 'Open inspection record and findings' },
  { key: 'inspection.list', name: 'List Inspections', description: 'Inspection schedule/register' },
  { key: 'inspection.update', name: 'Update Inspection', description: 'Record findings and completion' },
  { key: 'schedule.create', name: 'Create Schedule', description: 'Add a recurring operational job' },
  { key: 'schedule.read', name: 'View Schedule', description: 'Open recurring schedule' },
  { key: 'schedule.list', name: 'List Schedules', description: 'Recurring job calendar/register' },
  { key: 'schedule.update', name: 'Update Schedule', description: 'Edit recurring schedule' },

  // ── Phase 2, batch 5 — marketing & sales (research-property-4) ──────────
  { key: 'listing.create', name: 'Create Listing', description: 'Draft a for-sale/for-rent listing' },
  { key: 'listing.read', name: 'View Listing', description: 'Open listing detail and price history' },
  { key: 'listing.list', name: 'List Listings', description: 'Listing table / sales board' },
  { key: 'listing.update', name: 'Update Listing', description: 'Edit listing content and terms' },
  { key: 'listing.publish', name: 'Publish Listing', description: 'Put a listing live (or pause/withdraw)' },
  { key: 'listing.manage', name: 'Manage Listings', description: 'Full listing control' },
  { key: 'lead.create', name: 'Create Lead', description: 'Capture a house hunter/buyer lead' },
  { key: 'lead.read', name: 'View Lead', description: 'Open lead profile and activity' },
  { key: 'lead.list', name: 'List Leads', description: 'Lead inbox/pipeline' },
  { key: 'lead.update', name: 'Update Lead', description: 'Edit lead status, assignment and follow-ups' },
  { key: 'lead.manage', name: 'Manage Leads', description: 'Full lead control incl. withdraw' },
  { key: 'viewing.create', name: 'Schedule Viewing', description: 'Book a property viewing' },
  { key: 'viewing.read', name: 'View Viewing', description: 'Open viewing record' },
  { key: 'viewing.list', name: 'List Viewings', description: 'Viewing scheduler/register' },
  { key: 'viewing.update', name: 'Update Viewing', description: 'Record viewing outcome and feedback' },
  { key: 'offer.create', name: 'Create Offer', description: 'Submit an offer (or a counter — new row)' },
  { key: 'offer.read', name: 'View Offer', description: 'Open offer and counter history' },
  { key: 'offer.list', name: 'List Offers', description: 'Offer comparison per listing' },
  { key: 'offer.update', name: 'Update Offer', description: 'Edit a submitted offer / withdraw' },
  { key: 'offer.approve', name: 'Approve Offer', description: 'Accept or reject an offer' },
  { key: 'handoff.create', name: 'Create Handoff', description: 'Cross-org: pass a captured lead to a landlord/PM org' },
];
