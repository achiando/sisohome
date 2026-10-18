/**
 * Untracked smoke helper — session inspection/mutation for the security smoke.
 *
 *   session-expiry <email>            print JSON: [{ id, expiresAt, createdAt }]
 *   set-session-expiry <email> <min>  set expiresAt = now + <min> minutes
 *
 *   ../../packages/database/node_modules/.bin/tsx src/seed/__smoke-db.ts <cmd> ...
 */

import { prisma } from "../prisma";

const [cmd, email, minutes] = process.argv.slice(2);
if (!cmd || !email) {
  console.error("usage: tsx __smoke-db.ts session-expiry <email> | set-session-expiry <email> <minutes>");
  process.exit(1);
}

if (cmd === "session-expiry") {
  const sessions = await prisma.session.findMany({
    where: { user: { email } },
    select: { id: true, expiresAt: true, createdAt: true },
  });
  console.log(JSON.stringify(sessions));
} else if (cmd === "set-session-expiry") {
  const mins = Number(minutes);
  if (!Number.isFinite(mins)) {
    console.error("minutes must be a number");
    process.exit(1);
  }
  const expiresAt = new Date(Date.now() + mins * 60_000);
  const result = await prisma.session.updateMany({
    where: { user: { email } },
    data: { expiresAt },
  });
  console.log(JSON.stringify({ updated: result.count, expiresAt: expiresAt.toISOString() }));
} else {
  console.error("unknown command:", cmd);
  process.exit(1);
}

await prisma.$disconnect();
