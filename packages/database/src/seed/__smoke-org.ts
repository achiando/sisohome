import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { OrganizationService } from "../tenancy/organization.service";
import { KIND_TEMPLATE_ROLES } from "../seed/org-kind-templates";

async function main() {
  const svc = new OrganizationService(prisma);
  const userIds: string[] = [];

  try {
    // Throwaway user
    const user = await prisma.user.create({
      data: {
        email: `smoke-org-${Date.now()}@example.com`,
        displayName: "Smoke Org User",
        status: "ACTIVE",
      },
    });
    userIds.push(user.id);

    for (const kind of ["LANDLORD", "PROPERTY_MANAGEMENT", "MAINTENANCE_COMPANY"] as const) {
      const org = await svc.createOrganization({
        userId: user.id,
        name: `Smoke ${kind} Co`,
        kind,
      });

      const roles = await prisma.role.findMany({ where: { organizationId: org.id } });
      assert.deepEqual(
        roles.map((r) => r.slug).sort(),
        KIND_TEMPLATE_ROLES[kind].map((r) => r.slug).sort(),
        `${kind} slugs`,
      );

      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        include: { roles: { include: { role: true } } },
      });
      assert.ok(membership && membership.status === "ACTIVE", `${kind} membership`);
      assert.equal(membership!.roles[0]!.role.slug, "owner", `${kind} owner role`);
      assert.ok(membership!.roles[0]!.role.isTemplate, `${kind} role is template`);
      console.log(`✅ ${kind}: org + owner membership OK`);
    }

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(refreshed?.onboardingCompletedAt, "onboardingCompletedAt set");

    // Second org for same user must NOT touch onboardingCompletedAt
    const before = refreshed!.onboardingCompletedAt!.getTime();
    await prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date(before - 100000) } });
    await svc.createOrganization({ userId: user.id, name: "Smoke Second Landlord", kind: "LANDLORD" });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after!.onboardingCompletedAt!.getTime(), before - 100000, "second org leaves onboarding flag");

    // Multi-org: same user now has 4 memberships
    const count = await prisma.organizationMember.count({ where: { userId: user.id, status: "ACTIVE" } });
    assert.equal(count, 4, "four active memberships");

    const auditCount = await prisma.auditLog.count({
      where: { actorUserId: user.id, action: "organization.create" },
    });
    assert.equal(auditCount, 4, "audit entries");

    console.log("✅ ORG SERVICE SMOKE OK");
  } finally {
    if (userIds.length) {
      await prisma.organizationMember.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      const orgs = await prisma.organization.findMany({
        where: { slug: { startsWith: "smoke-" } },
        select: { id: true },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgs.map((o) => o.id) } } });
      console.log("🧹 cleaned up");
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
