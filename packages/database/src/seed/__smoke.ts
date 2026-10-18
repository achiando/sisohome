import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { seedOrgKindRoles, ensureGlobalRoleSlugIndex, KIND_TEMPLATE_ROLES } from "./org-kind-templates";

async function main() {
  await ensureGlobalRoleSlugIndex(prisma as never);

  const kinds = ["LANDLORD", "PROPERTY_MANAGEMENT", "MAINTENANCE_COMPANY"] as const;
  const created: string[] = [];

  try {
    for (const kind of kinds) {
      const org = await prisma.organization.create({
        data: { name: `Smoke ${kind}`, slug: `smoke-${kind.toLowerCase()}-${Date.now()}`, kind },
      });
      created.push(org.id);

      await seedOrgKindRoles(prisma as never, org.id, kind);
      // idempotency: run twice
      await seedOrgKindRoles(prisma as never, org.id, kind);

      const roles = await prisma.role.findMany({ where: { organizationId: org.id } });
      const slugs = roles.map((r) => r.slug).sort();
      assert.deepEqual(slugs, [...KIND_TEMPLATE_ROLES[kind].map((r) => r.slug)].sort(), `${kind} slugs`);
      assert.ok(roles.every((r) => r.isTemplate && !r.isSystem), `${kind} flags`);

      for (const template of KIND_TEMPLATE_ROLES[kind]) {
        const role = roles.find((r) => r.slug === template.slug)!;
        const count = await prisma.rolePermission.count({ where: { roleId: role.id } });
        assert.equal(count, template.permissions.length, `${kind}.${template.slug} permission count after double-seed`);
      }
      console.log(`✅ ${kind}: ${roles.length} template roles, permission counts stable after re-run`);
    }

    // partial unique index exists
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'roles' AND indexname = 'roles_global_slug_unique'
    `;
    assert.equal(indexes.length, 1, "roles_global_slug_unique missing");
    console.log("✅ partial unique index present");
    console.log("✅ SMOKE OK");
  } finally {
    if (created.length) {
      await prisma.organization.deleteMany({ where: { id: { in: created } } });
      console.log("🧹 cleaned up smoke orgs");
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
