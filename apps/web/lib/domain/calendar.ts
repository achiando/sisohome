/**
 * Landlord-attention calendar (plan-roadmap Phase 3) — one read model over
 * the open rows of five property domains plus derived vacant-unit markers.
 *
 * Row scoping stays per-domain (each keeps its own rules):
 *   viewings       → viewingScopeWhere (property scope | own org | agent)
 *   lease ends     → property scope — ACTIVE/ENDING, endsAt in range
 *   work orders    → property scope — open, scheduledFor in range
 *   inspections    → property scope — open, scheduledFor in range
 *   recurring dues → property scope — isActive, nextDueAt in range
 *   vacant units   → property scope — status VACANT (present-state markers)
 *
 * The route `GET /api/calendar` is open to any authenticated org member (no
 * route permission key, by plan) — so each event CLASS is filtered here by
 * its own `<domain>.list` key, the same key its list route requires. No new
 * permission keys. An MM org therefore only ever sees its
 * agreement/assigned properties (propertyScopeWhere arms), and only for
 * classes it may list.
 *
 * `date` is the UTC calendar day of the event instant (there is no
 * org-timezone model). Vacancy is a present-state signal: VACANT_UNIT
 * markers are dated today and emitted only when today falls inside the
 * requested range; the `vacantUnits` panel list is always current and
 * range-independent.
 */

import type { Prisma } from '@workspace/database';
import { authorizationService, db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { viewingScopeWhere } from './sales';

export type CalendarEventKind =
  | 'VIEWING'
  | 'LEASE_END'
  | 'WORK_ORDER'
  | 'INSPECTION'
  | 'RECURRING'
  | 'VACANT_UNIT';

export interface CalendarEvent {
  kind: CalendarEventKind;
  id: string;
  /** YYYY-MM-DD (UTC day of the instant; vacant markers = today). */
  date: string;
  title: string;
  propertyId: string;
  unitId?: string | null;
  href: string;
}

export interface CalendarVacantUnit {
  id: string;
  unitRef: string;
  label: string;
  propertyId: string;
  propertyName: string;
}

/** Type alias (not interface) — must satisfy apiRoute's `Record<string, unknown>` return. */
export type CalendarResult = {
  /** Flat, sorted (date → kind → title). */
  events: CalendarEvent[];
  /** Currently-vacant units for the side panel — always in scope, any range. */
  vacantUnits: CalendarVacantUnit[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
/** Per-class safety cap — a month view is far below this. */
const TAKE = 500;

/** `<domain>.list` key per event class — same keys the list routes require. */
const CLASS_GATE = {
  VIEWING: 'viewing.list',
  LEASE_END: 'lease.list',
  WORK_ORDER: 'work_order.list',
  INSPECTION: 'inspection.list',
  RECURRING: 'schedule.list',
} as const;
const VACANT_GATE = 'unit.list';

const INSPECTION_KIND_LABEL: Record<string, string> = {
  MOVE_IN: 'Move-in',
  MOVE_OUT: 'Move-out',
  ROUTINE: 'Routine',
  SAFETY: 'Safety',
  COMPLIANCE: 'Compliance',
  OTHER: 'Inspection',
};

function isoDay(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function parseDay(value: string, field: 'from' | 'to'): Date {
  if (!DATE_RE.test(value)) throw new RouteError(400, `${field} must be YYYY-MM-DD`);
  const day = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || isoDay(day) !== value) {
    throw new RouteError(400, `${field} is not a valid date`);
  }
  return day;
}

/** Current UTC month bounds — default when neither bound is supplied. */
function defaultRange(): { from: Date; to: Date } {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
  };
}

export async function getCalendarEvents(
  actor: ScopeActor,
  query: { from?: string | null; to?: string | null } = {},
): Promise<CalendarResult> {
  if ((query.from != null) !== (query.to != null)) {
    throw new RouteError(400, 'from and to must be provided together');
  }
  const ranged = query.from != null && query.to != null;
  const { from, to } = ranged
    ? { from: parseDay(query.from as string, 'from'), to: parseDay(query.to as string, 'to') }
    : defaultRange();
  if (to < from) throw new RouteError(400, 'from must be on or before to');
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    throw new RouteError(400, `range too wide (max ${MAX_RANGE_DAYS} days)`);
  }
  // Inclusive upper bound: the end of `to` in UTC.
  const lte = new Date(to.getTime() + 86_400_000 - 1);

  const granted = await authorizationService.getUserPermissions(actor.userId, actor.organizationId);
  const can = (key: string) => granted.includes(key as never);

  const events: CalendarEvent[] = [];

  if (can(CLASS_GATE.VIEWING)) {
    const rows = await db.propertyViewing.findMany({
      where: { ...viewingScopeWhere(actor), status: 'SCHEDULED', scheduledAt: { gte: from, lte } },
      select: {
        id: true,
        scheduledAt: true,
        propertyId: true,
        unitId: true,
        property: { select: { name: true } },
        lead: { select: { displayName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      events.push({
        kind: 'VIEWING',
        id: r.id,
        date: isoDay(r.scheduledAt),
        title: `Viewing @ ${r.property.name}${r.lead ? ` · ${r.lead.displayName}` : ''}`,
        propertyId: r.propertyId,
        unitId: r.unitId,
        href: `/sales/viewings/${r.id}/edit`,
      });
    }
  }

  if (can(CLASS_GATE.LEASE_END)) {
    const where: Prisma.LeaseWhereInput = {
      status: { in: ['ACTIVE', 'ENDING'] },
      endsAt: { not: null, gte: from, lte },
      // Choke point last — never overridable (property-scope §B).
      property: propertyScopeWhere(actor),
    };
    const rows = await db.lease.findMany({
      where,
      select: {
        id: true,
        endsAt: true,
        propertyId: true,
        property: { select: { name: true } },
        units: {
          select: { unitId: true, unit: { select: { unitRef: true } } },
          take: 1,
        },
      },
      orderBy: { endsAt: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      if (!r.endsAt) continue;
      const leaseUnit = r.units[0];
      events.push({
        kind: 'LEASE_END',
        id: r.id,
        date: isoDay(r.endsAt),
        title: `Lease ends @ ${r.property.name}${leaseUnit ? ` · ${leaseUnit.unit.unitRef}` : ''}`,
        propertyId: r.propertyId,
        unitId: leaseUnit?.unitId,
        href: `/leasing/leases/${r.id}`,
      });
    }
  }

  if (can(CLASS_GATE.WORK_ORDER)) {
    const where: Prisma.WorkOrderWhereInput = {
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      scheduledFor: { gte: from, lte },
      property: propertyScopeWhere(actor),
    };
    const rows = await db.workOrder.findMany({
      where,
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        propertyId: true,
        unitId: true,
        property: { select: { name: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      if (!r.scheduledFor) continue;
      events.push({
        kind: 'WORK_ORDER',
        id: r.id,
        date: isoDay(r.scheduledFor),
        title: `${r.title} @ ${r.property.name}`,
        propertyId: r.propertyId,
        unitId: r.unitId,
        href: `/maintenance/work-orders/${r.id}`,
      });
    }
  }

  if (can(CLASS_GATE.INSPECTION)) {
    const where: Prisma.InspectionWhereInput = {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      scheduledFor: { gte: from, lte },
      property: propertyScopeWhere(actor),
    };
    const rows = await db.inspection.findMany({
      where,
      select: {
        id: true,
        kind: true,
        scheduledFor: true,
        propertyId: true,
        unitId: true,
        property: { select: { name: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      if (!r.scheduledFor) continue;
      const label = INSPECTION_KIND_LABEL[r.kind] ?? 'Inspection';
      events.push({
        kind: 'INSPECTION',
        id: r.id,
        date: isoDay(r.scheduledFor),
        title: `${label} inspection @ ${r.property.name}`,
        propertyId: r.propertyId,
        unitId: r.unitId,
        href: `/maintenance/inspections/${r.id}`,
      });
    }
  }

  if (can(CLASS_GATE.RECURRING)) {
    const where: Prisma.RecurringScheduleWhereInput = {
      isActive: true,
      nextDueAt: { gte: from, lte },
      property: propertyScopeWhere(actor),
    };
    const rows = await db.recurringSchedule.findMany({
      where,
      select: {
        id: true,
        title: true,
        nextDueAt: true,
        propertyId: true,
        unitId: true,
        property: { select: { name: true } },
      },
      orderBy: { nextDueAt: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      if (!r.nextDueAt) continue;
      events.push({
        kind: 'RECURRING',
        id: r.id,
        date: isoDay(r.nextDueAt),
        title: `${r.title} @ ${r.property.name}`,
        propertyId: r.propertyId,
        unitId: r.unitId,
        href: `/maintenance/schedule/${r.id}`,
      });
    }
  }

  const vacantUnits: CalendarVacantUnit[] = [];
  if (can(VACANT_GATE)) {
    const rows = await db.unit.findMany({
      where: { status: 'VACANT', property: propertyScopeWhere(actor) },
      select: {
        id: true,
        unitRef: true,
        label: true,
        propertyId: true,
        property: { select: { name: true } },
      },
      orderBy: { unitRef: 'asc' },
      take: TAKE,
    });
    for (const r of rows) {
      vacantUnits.push({
        id: r.id,
        unitRef: r.unitRef,
        label: r.label,
        propertyId: r.propertyId,
        propertyName: r.property.name,
      });
    }
    // Present-state markers: dated today, only when today is in range.
    const today = isoDay(new Date());
    if (today >= isoDay(from) && today <= isoDay(to)) {
      for (const r of rows) {
        events.push({
          kind: 'VACANT_UNIT',
          id: r.id,
          date: today,
          title: `Vacant · ${r.unitRef} @ ${r.property.name}`,
          propertyId: r.propertyId,
          unitId: r.id,
          href: `/portfolio/${r.propertyId}/units`,
        });
      }
    }
  }

  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.kind.localeCompare(b.kind) ||
      a.title.localeCompare(b.title),
  );
  return { events, vacantUnits };
}
