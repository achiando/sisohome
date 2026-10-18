import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { OrganizationService } from "../tenancy/organization.service";

async function main() {
  const svc = new OrganizationService(prisma);
  const email = `smoke-mkt-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: { email, displayName: "Smoke Marketing User", status: "ACTIVE" },
  });

  try {
    const org = await svc.createOrganization({
      userId: user.id,
      name: "Smoke Marketing Co",
      kind: "MARKETING_AGENT",
    });

    const roles = await prisma.role.findMany({
      where: { organizationId: org.id },
      include: { permissions: { include: { permission: true } } },
    });
    assert.deepEqual(
      roles.map((r) => r.slug).sort(),
      ["marketing_agent", "owner", "viewer"],
      "MARKETING_AGENT slug set",
    );

    const agent = roles.find((r) => r.slug === "marketing_agent")!;
    const keys = agent.permissions.map((rp) => rp.permission.key).sort();
    for (const k of ["resource.create", "resource.update", "membership.invite", "audit.read", "organization.read"]) {
      assert.ok(keys.includes(k), `marketing_agent has ${k}`);
    }
    for (const forbidden of ["role.assign", "role.manage", "permission.manage", "user.delete", "organization.manage"]) {
      assert.ok(!keys.includes(forbidden), `marketing_agent must NOT have ${forbidden}`);
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      include: { roles: { include: { role: true } } },
    });
    assert.ok(membership && membership.status === "ACTIVE", "creator membership active");
    assert.equal(membership!.roles[0]!.role.slug, "owner", "creator is owner");
    assert.ok(membership!.roles[0]!.role.isTemplate, "owner role is template");

    console.log("✅ MARKETING_AGENT org + template roles OK:", roles.map((r) => r.slug).join(", "));
    console.log("✅ marketing_agent grants:", keys.join(", "));
  } finally {
    await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.rolePermission.deleteMany({
      where: { roleId: { in: (await prisma.role.findMany({ where: { organization: { name: "Smoke Marketing Co" } }, select: { id: true } })).map((r) => r.id) } },
    });
    await prisma.role.deleteMany({ where: { organization: { name: "Smoke Marketing Co" } } });
    await prisma.organization.deleteMany({ where: { name: "Smoke Marketing Co" } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("🧹 cleaned up");
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
