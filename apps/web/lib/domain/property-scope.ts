/**
 * The single choke point for property-domain authorization scoping.
 *
 * Every property-family read/write flows through `propertyScopeWhere` —
 * permission ∧ relationship, server-side (AGENTS.md authorization rules).
 *
 * The critical rule (plan-api-ui.md §B): child rows of a property (units,
 * leases, tickets, charges, listings, …) carry the PROPERTY'S
 * `portfolioOrganizationId` as their own `organizationId` — NOT the
 * caller's org. Scoping a child by `organizationId = actor.organizationId`
 * alone returns zero rows for PM/MM orgs. Scope children THROUGH the
 * parent: `{ property: propertyScopeWhere(actor) }`.
 *
 * The four arms a caller can reach a property by:
 *   1. Own portfolio        — landlord / PM / MM owner's own assets
 *   2. Management agreement — PM (or MM) with an ACTIVE agreement in window
 *   3. Staff assignment     — person assigned to the property (any org)
 *   4. Assigned work order  — maintenance company reached per-job (arm 4)
 *
 * Every list is a `findMany({ where: { …, property: propertyScopeWhere } })`;
 * every mutation fetches → asserts parent scope → `updateMany({ where: { id,
 * organizationId: <child's own org> } })` so a guessed ID from another
 * tenant can never match.
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';

/** Non-null actor handed to every service call by `apiRoute`. */
export type ScopeActor = {
  userId: string;
  organizationId: string;
};

/** Standard child `where` fragment: property relation + caller extras. */
export function propertyScopeWhere(actor: ScopeActor): Prisma.PropertyWhereInput {
  const now = new Date();
  return {
    OR: [
      // 1. Own portfolio (landlord / PM or MM owner's own assets)
      { portfolioOrganizationId: actor.organizationId },
      // 2. Active management agreement — covers PM *and* MM whole-property ops
      {
        managementAgreements: {
          some: {
            managementOrganizationId: actor.organizationId,
            status: 'ACTIVE',
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        },
      },
      // 3. Direct staff assignment (caretaker / assigned PM staff — any org)
      {
        staffAssignments: {
          some: {
            userId: actor.userId,
            isActive: true,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        },
      },
      // 4. Maintenance company reached per-job (has an assigned work order)
      {
        workOrders: {
          some: { assignments: { some: { assigneeOrganizationId: actor.organizationId } } },
        },
      },
    ],
  };
}

/**
 * Fetch the scoped property's ids — use when a child create needs the
 * property's `portfolioOrganizationId` (the child's org). 404 if out of
 * scope. `assertPropertyInScope` is the no-detail variant.
 */
export async function requirePropertyInScope(
  actor: ScopeActor,
  propertyId: string,
): Promise<{ id: string; portfolioOrganizationId: string; amenities: string[] }> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(actor) },
    // `amenities` rides along so child writes can strip property-level rows
    // (unit/building amenities never duplicate the property's own).
    select: { id: true, portfolioOrganizationId: true, amenities: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');
  return property;
}

export async function assertPropertyInScope(
  actor: ScopeActor,
  propertyId: string,
): Promise<void> {
  await requirePropertyInScope(actor, propertyId);
}

/**
 * Assert parent scope for a mutation on an already-loaded property child,
 * returning the exact `updateMany` where-clause: the row's own id AND the
 * row's own organizationId (defense in depth — even if the caller stuffed
 * another org's id in the URL, scope already failed above).
 */
export async function resolveChildUpdateScope(
  actor: ScopeActor,
  child: { id: string; organizationId: string; propertyId: string },
): Promise<{ id: string; organizationId: string }> {
  await assertPropertyInScope(actor, child.propertyId);
  return { id: child.id, organizationId: child.organizationId };
}

/**
 * Standard fragment for ANY property-child query (units, leases, tickets,
 * charges, viewings, …):
 *
 *   prisma.lease.findMany({ where: childScope(actor, { status: 'ACTIVE' }) })
 */
export function childScope<T extends Record<string, unknown>>(
  actor: ScopeActor,
  extra?: T,
): T & { property: Prisma.PropertyWhereInput } {
  // `property` is spread LAST — callers can never weaken or override the
  // scope predicate (the choke point).
  return { ...extra, property: propertyScopeWhere(actor) } as T & {
    property: Prisma.PropertyWhereInput;
  };
}

/**
 * MK (marketing agent) read side — Listing ONLY, never Property:
 * own listings OR listings shared to this org. The response shape still
 * projects away internal property fields (plan-slice-5 §1).
 */
export function listingProjectionScope(actor: ScopeActor): Prisma.ListingWhereInput {
  return {
    OR: [
      { organizationId: actor.organizationId },
      { marketingOrganizationId: actor.organizationId },
    ],
  };
}
