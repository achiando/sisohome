/**
 * Untracked smoke helper — deletes one throwaway account by email
 * (cascades sessions, reset tokens, OTP codes, recovery codes, memberships).
 *
 *   ../../packages/database/node_modules/.bin/tsx src/seed/__smoke-del-user.ts <email>
 */

import { prisma } from "../prisma";

const email = process.argv[2];
if (!email) {
  console.error("usage: tsx __smoke-del-user.ts <email>");
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.log("no user:", email);
} else {
  await prisma.user.delete({ where: { id: user.id } });
  console.log("deleted:", email);
}
await prisma.$disconnect();
