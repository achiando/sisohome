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

// `Prisma` namespace (WhereInput/CreateInput types, Decimal, JsonValue, …)
// so app code never reaches into the generated directory.
export { Prisma } from '../generated/prisma/client';

// Model types (Property, Unit, Lease, Charge, …) — type-only re-exports of
// the generated `client.ts` aliases (`Property = Prisma.PropertyModel`).
// Type-only: no runtime graph, safe as `import type { … }` anywhere.
// KEEP IN SYNC when schema models are added — list = `client.ts` `export
// type <Model> = Prisma.<Model>Model` lines (excluding PrismaClient).
// NOTE: Role / Permission / ResourceRelationship are intentionally omitted —
// those names belong to the domain interfaces in ./authorization (index.ts
// `export *` ambiguity); use `Prisma.RoleModel` etc. when you need the raw
// row shape.
export type {
  User,
  PasswordResetToken,
  EmailVerificationToken,
  EmailOtpCode,
  UserRecoveryCode,
  UserConsent,
  UserProfile,
  Session,
  Organization,
  OrganizationLocation,
  OrganizationMember,
  OrganizationMemberRole,
  RolePermission,
  AuditLog,
  Property,
  Building,
  Unit,
  UnitType,
  PropertyOwnerParty,
  PropertyOwnership,
  PropertyManagementAgreement,
  PropertyStaffAssignment,
  PropertyDocument,
  Tenant,
  TenantPortalInvite,
  Lease,
  LeaseUnit,
  LeaseTenant,
  DocumentVersion,
  RentalApplication,
  ChargeSchedule,
  Charge,
  Payment,
  PaymentAllocation,
  FinancialAdjustment,
  PropertyExpense,
  Receipt,
  MaintenanceTicket,
  WorkOrder,
  WorkOrderAssignment,
  Inspection,
  RecurringSchedule,
  Listing,
  ListingPriceHistory,
  Lead,
  Handoff,
  PropertyViewing,
  Offer,
  PropertyDeal,
} from '../generated/prisma/client';
