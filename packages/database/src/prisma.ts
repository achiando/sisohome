/**
 * Central Prisma Client Export
 * Consistent import path for all services
 *
 * Prisma 7 requires a driver adapter — see packages/tijwa-db/src/index.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as PrismaClientClass } from '../generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientClass | undefined;
};

function createClient(): PrismaClientClass {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[@workspace/database] DATABASE_URL is not set. Define it in the app's .env file before using prisma.",
    );
  }
  return new PrismaClientClass({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClientClass as PrismaClient };

// Schema enums (UserStatus, ConsentType, …) — generated to the client but
// re-exported here so app code can import them from '@workspace/database'.
export * from '../generated/prisma/enums';
