/**
 * Single-org (staff/worker) role policy
 *
 * Staff roles are single-organization: a user holding one of these may
 * belong to exactly ONE active organization (BUILD.md §1 multi-org rule —
 * staff do not blend across tenants; only owners/admins may span orgs).
 *
 * Shared by:
 * - membership.service  (blocks create/assign when the user already has an
 *   active membership in a different organization)
 * - organization.service (blocks creating another org while holding an
 *   active staff membership elsewhere)
 * - role.service         (exposes RoleView.singleOrg for the UI)
 *
 * This module is dependency-free on purpose so it can be imported from any
 * service without import cycles. Custom (non-template) roles created by
 * admins are multi-org by default.
 */

export const SINGLE_ORG_ROLE_SLUGS: ReadonlySet<string> = new Set([
  "manager",
  "property_manager",
  "finance_officer",
  "finance_approver",
  "leasing_officer",
  "caretaker",
  "maintenance_coordinator",
  "member",
  "technician",
  "coordinator",
  "marketing_agent",
  "viewer",
]);

export function isSingleOrgRole(slug: string): boolean {
  return SINGLE_ORG_ROLE_SLUGS.has(slug);
}
