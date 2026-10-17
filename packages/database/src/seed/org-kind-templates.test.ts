/**
 * Kind role-template matrix guard (run: pnpm --filter @workspace/database test)
 * Asserts the exact slug sets and grant invariants from BUILD.md §1.1 so
 * template drift fails CI. No DB required.
 */

import assert from "node:assert/strict";
import { KIND_TEMPLATE_ROLES, type OrganizationKindValue } from "./org-kind-templates";
import { FOUNDATION_PERMISSIONS } from "./foundation-permissions";

const EXPECTED_SLUGS: Record<OrganizationKindValue, string[]> = {
  LANDLORD: ["owner", "manager", "viewer"],
  PROPERTY_MANAGEMENT: [
    "owner",
    "admin",
    "property_manager",
    "finance_officer",
    "finance_approver",
    "leasing_officer",
    "caretaker",
    "maintenance_coordinator",
    "member",
    "viewer",
  ],
  MAINTENANCE_COMPANY: ["owner", "admin", "coordinator", "technician", "viewer"],
  MARKETING_AGENT: ["owner", "marketing_agent", "viewer"],
};

const catalog = new Set(FOUNDATION_PERMISSIONS.map((p) => p.key));
const kinds = Object.keys(EXPECTED_SLUGS) as OrganizationKindValue[];

// 1. Exact slug sets per kind
for (const kind of kinds) {
  const slugs = KIND_TEMPLATE_ROLES[kind].map((r) => r.slug);
  assert.deepEqual(slugs, EXPECTED_SLUGS[kind], `${kind}: slug set drifted from BUILD.md §1.1`);
}

// 2. Every permission key exists in the foundation catalog
for (const kind of kinds) {
  for (const role of KIND_TEMPLATE_ROLES[kind]) {
    for (const key of role.permissions) {
      assert.ok(catalog.has(key), `${kind}.${role.slug}: unknown permission key "${key}"`);
    }
  }
}

// 3. No duplicate permission keys within a role; no empty roles
for (const kind of kinds) {
  for (const role of KIND_TEMPLATE_ROLES[kind]) {
    assert.ok(role.permissions.length > 0, `${kind}.${role.slug}: empty permission set`);
    assert.equal(
      new Set(role.permissions).size,
      role.permissions.length,
      `${kind}.${role.slug}: duplicate permission keys`,
    );
  }
}

// 4. The owner template is identical across kinds (multi-org consistency)
const ownerSets = kinds.map((k) =>
  [...KIND_TEMPLATE_ROLES[k].find((r) => r.slug === "owner")!.permissions].sort(),
);
assert.deepEqual(ownerSets[1], ownerSets[0], "PROPERTY_MANAGEMENT.owner differs from LANDLORD.owner");
assert.deepEqual(ownerSets[2], ownerSets[0], "MAINTENANCE_COMPANY.owner differs from LANDLORD.owner");

// 5. Every kind has at least owner + viewer
for (const kind of kinds) {
  const slugs = new Set(EXPECTED_SLUGS[kind]);
  assert.ok(slugs.has("owner"), `${kind}: missing owner`);
  assert.ok(slugs.has("viewer"), `${kind}: missing viewer`);
}

// 6. Separation of duties: finance_approver never gets resource.update in Phase 1
//    (submit ≠ approve; expense.* keys land in Phase 2)
{
  const approver = KIND_TEMPLATE_ROLES.PROPERTY_MANAGEMENT.find(
    (r) => r.slug === "finance_approver",
  )!;
  const officer = KIND_TEMPLATE_ROLES.PROPERTY_MANAGEMENT.find((r) => r.slug === "finance_officer")!;
  assert.ok(!approver.permissions.includes("resource.update"), "finance_approver must not get resource.update");
  assert.ok(officer.permissions.includes("resource.update"), "finance_officer keeps resource.update");
}

// 7. Viewer is truly read-only
for (const kind of kinds) {
  const viewer = KIND_TEMPLATE_ROLES[kind].find((r) => r.slug === "viewer")!;
  for (const key of viewer.permissions) {
    assert.ok(
      /\.(read|list|view)$/.test(key),
      `${kind}.viewer: unexpected non-read permission "${key}"`,
    );
  }
}

console.log("✅ org-kind-templates matrix guard passed");
