/**
 * Tenant portal domain (plan-slice-7 §1.3/§2) — relationship-scoped reads
 * and the two portal writes (ticket create, ticket note append).
 *
 * Every function takes a `PortalTenantActor` (already ownership-verified by
 * `apiRoutePortal`) and filters by `tenantId` — either directly
 * (`{ tenantId }`) or through the tenant's leases
 * (`lease: { parties: { some: { tenantId } } }`). Cross-tenant ids simply
 * match nothing → 404. Org lists, staff data and permission machinery never
 * appear here: portal access IS the tenant row.
 *
 * Staff-facing status stays org-controlled: a portal ticket write can never
 * touch `MaintenanceTicket.status` — conversation lives in
 * `MaintenanceTicketNote`.
 */

import { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from './maintenance-constants';
import type { PortalTenantActor } from '@/lib/portal-guard';

type Raw = Record<string, unknown>;

const CATEGORY_VALUES = TICKET_CATEGORIES.map((o) => o.value);
const PRIORITY_VALUES = TICKET_PRIORITIES.map((o) => o.value);

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new RouteError(400, `Invalid ${field}`);
  return v as T;
}

/** Lease ids the tenant is a party to — the statement/document bridge. */
async function tenantLeaseIds(tenantId: string): Promise<string[]> {
  const rows = await db.leaseTenant.findMany({
    where: { tenantId },
    select: { leaseId: true },
  });
  return rows.map((r) => r.leaseId);
}

// ── lease ────────────────────────────────────────────────────────────────────

/** Active + historical leases: dates, units, rent, co-parties, manager org. */
export async function getPortalLeases(actor: PortalTenantActor) {
  const links = await db.leaseTenant.findMany({
    where: { tenantId: actor.tenantId },
    include: {
      lease: {
        include: {
          property: { select: { id: true, name: true, locality: true, addressLine1: true } },
          organization: { select: { id: true, name: true } },
          units: { include: { unit: { select: { id: true, unitRef: true, label: true } } } },
          parties: { include: { tenant: { select: { id: true, displayName: true } } } },
        },
      },
    },
    orderBy: { lease: { startsAt: 'desc' } },
  });

  return links.map(({ relationship, lease }) => ({
    id: lease.id,
    leaseRef: lease.leaseRef,
    status: lease.status,
    tenureType: lease.tenureType,
    startsAt: lease.startsAt,
    endsAt: lease.endsAt,
    signedAt: lease.signedAt,
    currency: lease.currency,
    billingFrequency: lease.billingFrequency,
    paymentDueDay: lease.paymentDueDay,
    depositMonths: lease.depositMonths,
    noticeDays: lease.noticeDays,
    autoRenew: lease.autoRenew,
    myRelationship: relationship,
    property: lease.property,
    manager: { organizationId: lease.organization.id, name: lease.organization.name },
    units: lease.units.map((lu) => ({
      id: lu.unit.id,
      unitRef: lu.unit.unitRef,
      label: lu.unit.label,
      monthlyRent: lu.monthlyRent,
      currency: lu.currency ?? lease.currency,
    })),
    parties: lease.parties.map((p) => ({
      tenantId: p.tenant.id,
      displayName: p.tenant.displayName,
      relationship: p.relationship,
      isSelf: p.tenant.id === actor.tenantId,
    })),
  }));
}

// ── statement ────────────────────────────────────────────────────────────────

/**
 * Charges + payments for the tenant's leases (plan: "charges + payments +
 * balance for this tenant's leases", derived — the portal never writes money).
 */
export async function getPortalStatement(actor: PortalTenantActor) {
  const leaseIds = await tenantLeaseIds(actor.tenantId);
  const scope: Prisma.ChargeWhereInput = {
    OR: [{ tenantId: actor.tenantId }, { leaseId: { in: leaseIds } }],
  };
  const paymentScope: Prisma.PaymentWhereInput = {
    OR: [{ tenantId: actor.tenantId }, { leaseId: { in: leaseIds } }],
  };

  const [charges, payments] = await Promise.all([
    db.charge.findMany({
      where: scope,
      include: {
        allocations: { select: { amount: true } },
        unit: { select: { id: true, label: true } },
      },
      orderBy: { dueDate: 'desc' },
    }),
    db.payment.findMany({
      where: paymentScope,
      orderBy: { receivedAt: 'desc' },
    }),
  ]);

  let chargesTotal = new Prisma.Decimal(0);
  let paidTotal = new Prisma.Decimal(0);
  const mappedCharges = charges.map((c) => {
    const paid = c.allocations.reduce((acc, a) => acc.plus(a.amount), new Prisma.Decimal(0));
    chargesTotal = chargesTotal.plus(c.amount);
    paidTotal = paidTotal.plus(paid);
    return {
      id: c.id,
      chargeType: c.chargeType,
      title: c.title,
      amount: c.amount,
      paid,
      outstanding: c.amount.minus(paid),
      currency: c.currency,
      dueDate: c.dueDate,
      unitLabel: c.unit?.label ?? null,
    };
  });

  let paymentsTotal = new Prisma.Decimal(0);
  const mappedPayments = payments.map((p) => {
    paymentsTotal = paymentsTotal.plus(p.amount);
    return {
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      reference: p.reference,
      receivedAt: p.receivedAt,
    };
  });

  return {
    charges: mappedCharges,
    payments: mappedPayments,
    totals: {
      charges: chargesTotal,
      paid: paidTotal,
      payments: paymentsTotal,
      /** outstanding charges − payments received (derived, org owns the truth). */
      balance: chargesTotal.minus(paymentsTotal),
    },
  };
}

// ── documents ────────────────────────────────────────────────────────────────

/**
 * Documents explicitly bound to the tenant or their leases — never property
 * listings, never other entities (PII). `storageKey` is included: when it is
 * an https URL the portal can open it directly (same as the org media tab);
 * generated evidence rows (relative pointer + caption) show caption only.
 */
export async function getPortalDocuments(actor: PortalTenantActor) {
  const leaseIds = await tenantLeaseIds(actor.tenantId);
  const docs = await db.propertyDocument.findMany({
    where: {
      OR: [
        { entityType: 'TENANT', entityId: actor.tenantId },
        { entityType: 'LEASE', entityId: { in: leaseIds } },
      ],
    },
    select: {
      id: true,
      kind: true,
      entityType: true,
      entityId: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      caption: true,
      storageKey: true,
      version: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return docs.map((d) => ({
    ...d,
    /** Remote file link vs generated in-house evidence (pointer, no bytes). */
    downloadUrl: /^https?:\/\//.test(d.storageKey) ? d.storageKey : null,
  }));
}

// ── maintenance tickets ──────────────────────────────────────────────────────

/** Own tickets only (`reportedByTenantId`) + the conversation thread. */
export async function getPortalTickets(actor: PortalTenantActor) {
  const tickets = await db.maintenanceTicket.findMany({
    where: { reportedByTenantId: actor.tenantId },
    include: {
      unit: { select: { id: true, unitRef: true, label: true } },
      property: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return tickets.map(mapTicket);
}

export async function getPortalTicket(actor: PortalTenantActor, id: string) {
  const ticket = await db.maintenanceTicket.findFirst({
    where: { id, reportedByTenantId: actor.tenantId },
    include: {
      unit: { select: { id: true, unitRef: true, label: true } },
      property: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!ticket) throw new RouteError(404, 'Maintenance ticket not found');
  return mapTicket(ticket);
}

/**
 * Staff data stays out of portal payloads: status/category/priority are
 * lifecycle facts (the tenant needs them), but work orders, assignees and
 * internal fields are never selected. Notes render as author-kind only.
 */
function mapTicket(t: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  reportedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  unit: { id: string; unitRef: string | null; label: string } | null;
  property: { id: string; name: string };
  notes: { id: string; body: string; authorTenantId: string | null; createdAt: Date }[];
}) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    reportedAt: t.reportedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    createdAt: t.createdAt,
    property: t.property,
    unit: t.unit,
    notes: t.notes.map((n) => ({
      id: n.id,
      body: n.body,
      author: n.authorTenantId ? ('tenant' as const) : ('staff' as const),
      createdAt: n.createdAt,
    })),
  };
}

/**
 * Create a ticket for one of the tenant's own units. The unit is REQUIRED
 * (portal reports are unit-bound) and must sit on one of their leases —
 * property falls out of the unit, so cross-property ids 404. Lands under
 * the property's portfolio org exactly like the staff-created path, so
 * org-side maintenance UI sees it unchanged.
 */
export async function createPortalTicket(actor: PortalTenantActor, raw: Raw) {
  const unitId = str(raw.unitId);
  if (!unitId) throw new RouteError(400, 'unitId is required');

  const unit = await db.unit.findFirst({
    where: {
      id: unitId,
      // Unit → LeaseUnit reverse relation is `leaseTerms` (schema naming).
      leaseTerms: { some: { lease: { parties: { some: { tenantId: actor.tenantId } } } } },
    },
    select: { id: true, propertyId: true, property: { select: { portfolioOrganizationId: true } } },
  });
  if (!unit) throw new RouteError(404, 'Unit not found');

  const title = str(raw.title);
  if (!title) throw new RouteError(400, 'title is required');
  if (title.length > 200) throw new RouteError(400, 'title must be 200 characters or fewer');
  const description = str(raw.description);
  if (description && description.length > 4000) {
    throw new RouteError(400, 'description must be 4000 characters or fewer');
  }

  const category = pick(raw.category, CATEGORY_VALUES, 'category') ?? 'GENERAL';
  const priority = pick(raw.priority, PRIORITY_VALUES, 'priority') ?? 'MEDIUM';

  const created = await db.maintenanceTicket.create({
    data: {
      organizationId: unit.property.portfolioOrganizationId,
      propertyId: unit.propertyId,
      unitId: unit.id,
      title,
      description: description ?? null,
      category: category as never,
      priority: priority as never,
      reportedByUserId: actor.userId,
      reportedByTenantId: actor.tenantId,
    },
  });
  await auditLog(
    { userId: actor.userId, organizationId: unit.property.portfolioOrganizationId },
    'MAINTENANCE_TICKET',
    'maintenance.ticket.create',
    created.id,
    { propertyId: unit.propertyId, priority: created.priority, source: 'portal' },
    unit.property.portfolioOrganizationId,
  );
  return mapCreated(created);
}

function mapCreated(t: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  reportedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
}) {
  // Minimal shape for the create response (unit/property resolved by list).
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    reportedAt: t.reportedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    createdAt: t.createdAt,
  };
}

/**
 * Append a reply to a ticket the tenant reported. ONLY `body` is accepted —
 * status/priority/title stay org-controlled (plan §2 security checklist:
 * a forged PATCH cannot move lifecycle fields). Cross-tenant id → 404.
 */
export async function appendPortalTicketNote(actor: PortalTenantActor, id: string, raw: Raw) {
  const ticket = await db.maintenanceTicket.findFirst({
    where: { id, reportedByTenantId: actor.tenantId },
    select: { id: true, organizationId: true },
  });
  if (!ticket) throw new RouteError(404, 'Maintenance ticket not found');

  const allowed = ['note'];
  const extra = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    throw new RouteError(400, 'Only a note can be appended — status is managed by property staff');
  }

  const body = str(raw.note);
  if (!body) throw new RouteError(400, 'note is required');
  if (body.length > 2000) throw new RouteError(400, 'note must be 2000 characters or fewer');

  const note = await db.maintenanceTicketNote.create({
    data: {
      ticketId: ticket.id,
      authorTenantId: actor.tenantId,
      authorUserId: actor.userId,
      body,
    },
  });
  await auditLog(
    { userId: actor.userId, organizationId: ticket.organizationId },
    'MAINTENANCE_TICKET',
    'maintenance.ticket_note.create',
    ticket.id,
    { noteId: note.id, source: 'portal' },
  );
  return { id: note.id, body: note.body, author: 'tenant' as const, createdAt: note.createdAt };
}

// ── payment instructions ─────────────────────────────────────────────────────

/**
 * Static "how to pay" info for the tenant's leases — the display-only
 * paybill/account reference on the property's ledger accounts (schema:
 * `LedgerAccount.reference`), with a generic M-Pesa fallback. No payment
 * initiation in v1 (plan §1.4 — real M-Pesa is out of wave).
 */
export async function getPortalPaymentInstructions(actor: PortalTenantActor) {
  const links = await db.leaseTenant.findMany({
    where: { tenantId: actor.tenantId },
    include: {
      lease: {
        select: {
          propertyId: true,
          currency: true,
          property: { select: { name: true, locality: true } },
        },
      },
    },
  });
  const propertyIds = [...new Set(links.map((l) => l.lease.propertyId))];

  const accounts = await db.ledgerAccount.findMany({
    where: { propertyId: { in: propertyIds }, isActive: true },
    select: { id: true, name: true, accountType: true, reference: true, currency: true },
    orderBy: { accountType: 'asc' },
  });

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      reference: a.reference,
      currency: a.currency,
    })),
    properties: links.map((l) => ({
      name: l.lease.property.name,
      locality: l.lease.property.locality,
    })),
    note: accounts.some((a) => a.reference)
      ? 'Pay to the reference shown for the account. Use your lease reference as the payment description.'
      : 'Ask your property manager for the M-Pesa till number for your building, then use your lease reference as the payment description.',
  };
}
