/**
 * Untracked smoke helper — prints the first role id of an organization so a
 * script can invite a member through /api/members.
 *
 *   ../../packages/database/node_modules/.bin/tsx src/seed/__smoke-role-id.ts "<org name>"
 */

import { prisma } from "../prisma";

const orgName = process.argv[2];
if (!orgName) {
  console.error("usage: tsx __smoke-role-id.ts <organization name>");
  process.exit(1);
}

const org = await prisma.organization.findFirst({ where: { name: orgName } });
if (!org) {
  console.error("no organization:", orgName);
  process.exit(1);
}

const role = await prisma.role.findFirst({
  where: { organizationId: org.id },
  orderBy: { createdAt: "asc" },
});
if (!role) {
  console.error("no role for organization:", orgName);
  process.exit(1);
}

console.log(role.id);
await prisma.$disconnect();
