/**
 * One-off backfill after adding User.emailVerifiedAt: every account that
 * existed before the verification gate must keep signing in, so existing
 * rows are marked verified. Accounts created afterwards start NULL and are
 * verified by clicking the emailed link.
 *
 *   set -a && source .env && set +a
 *   ../../packages/database/node_modules/.bin/tsx src/seed/__backfill-email-verified.ts
 */

import { prisma } from "../prisma";

const result = await prisma.user.updateMany({
  where: { emailVerifiedAt: null },
  data: { emailVerifiedAt: new Date() },
});

console.log(`emailVerifiedAt backfilled for ${result.count} existing user(s)`);
await prisma.$disconnect();
