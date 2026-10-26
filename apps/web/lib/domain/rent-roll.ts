/**
 * Rent roll (Slice 8) — one row per unit of a property: occupancy + lease
 * rent, open/overdue balances from posted charges, and a rolled state.
 *
 * Occupancy mirrors `unit.ts`'s occupant map (ACTIVE/ENDING lease, started,
 * not ended; earliest lease wins). Balances use the shared rule: amount −
 * Σ allocations − Σ approved adjustments. Building subtotals bucket
 * building-less units under `null` so the sums always tie to `totals`.
 */

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, type ScopeActor } from './property-scope';

export type RentRollState = 'VACANT' | 'OVERDUE' | 'DUE' | 'PAID' | 'NO_CHARGES';

export interface RentRollRow {
  unitId: string;
  unitRef: string;
  label: string;
  buildingId: string | null;
  buildingName: string | null;
  occupancy: 'OCCUPIED' | 'VACANT';
  tenantId: string | null;
  tenantName: string | null;
  leaseId: string | null;
  leaseEndsAt: string | null;
  monthlyRent: string;
  openBalance: string;
  overdueBalance: string;
  oldestDueDate: string | null;
  nextDueDate: string | null;
  currency: string;
  state: RentRollState;
}

export interface RentRollBuilding {
  buildingId: string | null;
  name: string;
  units: number;
  occupied: number;
  vacant: number;
  monthlyRent: string;
  openBalance: string;
  overdueBalance: string;
}

export interface RentRollTotals {
  units: number;
  occupied: number;
  vacant: number;
  monthlyRent: string;
  openBalance: string;
  overdueBalance: string;
}

export interface RentRollResult {
  property: { id: string; name: string; code: string | null; currency: string };
  totals: RentRollTotals;
  buildings: RentRollBuilding[];
  rows: RentRollRow[];
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function rentRoll(actor: ScopeActor, propertyId: string): Promise<RentRollResult> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(actor) },
    select: { id: true, name: true, code: true, currency: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');

  const units = await db.unit.findMany({
    where: { propertyId },
    select: {
      id: true,
      unitRef: true,
      label: true,
      buildingId: true,
      building: { select: { code: true, name: true } },
    },
    orderBy: { unitRef: 'asc' },
  });
  const unitIds = units.map((u) => u.id);
  const now = new Date();

  const [occupants, charges] = await Promise.all([
    db.leaseUnit.findMany({
      where: {
        unitId: { in: unitIds },
        lease: {
          status: { in: ['ACTIVE', 'ENDING'] },
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      },
      select: {
        unitId: true,
        monthlyRent: true,
        currency: true,
        lease: {
          select: {
            id: true,
            endsAt: true,
            parties: {
              orderBy: [{ relationship: 'asc' }, { createdAt: 'asc' }],
              select: { relationship: true, tenant: { select: { id: true, displayName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.charge.findMany({
      where: {
        propertyId,
        organizationId: actor.organizationId,
        postedAt: { not: null },
        unitId: { in: unitIds },
      },
      select: {
        unitId: true,
        amount: true,
        currency: true,
        dueDate: true,
        allocations: { select: { amount: true } },
        adjustments: { select: { amount: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5000,
    }),
  ]);

  interface UnitMoney {
    open: number;
    overdue: number;
    chargeCount: number;
    oldest: Date | null;
    next: Date | null;
    currency: string | null;
  }
  const money = new Map<string, UnitMoney>();
  const today = dayStart(now);
  for (const c of charges) {
    if (!c.unitId) continue;
    const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const adjusted = c.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + Number(a.amount), 0);
    const balance = Number(c.amount) - allocated - adjusted;
    if (balance <= 0.009) continue;
    const due = dayStart(c.dueDate);
    const m =
      money.get(c.unitId) ??
      { open: 0, overdue: 0, chargeCount: 0, oldest: null, next: null, currency: null };
    m.open += balance;
    m.chargeCount += 1;
    m.currency ??= c.currency;
    if (!m.oldest || due < m.oldest) m.oldest = due;
    if (due >= today && (!m.next || due < m.next)) m.next = due;
    if (due < today) m.overdue += balance;
    money.set(c.unitId, m);
  }

  const occupantByUnit = new Map<
    string,
    { tenantId: string; tenantName: string; leaseId: string; leaseEndsAt: Date | null; monthlyRent: string }
  >();
  for (const o of occupants) {
    if (occupantByUnit.has(o.unitId)) continue; // earliest lease wins
    const parties = o.lease.parties;
    const primary = parties.find((p) => p.relationship === 'PRIMARY') ?? parties[0];
    if (!primary) continue;
    occupantByUnit.set(o.unitId, {
      tenantId: primary.tenant.id,
      tenantName: primary.tenant.displayName,
      leaseId: o.lease.id,
      leaseEndsAt: o.lease.endsAt,
      monthlyRent: o.monthlyRent.toString(),
    });
  }

  const rows: RentRollRow[] = units.map((u) => {
    const occ = occupantByUnit.get(u.id) ?? null;
    const m = money.get(u.id) ?? null;
    const open = m?.open ?? 0;
    const overdue = m?.overdue ?? 0;
    const state: RentRollState = !occ
      ? 'VACANT'
      : !m || m.chargeCount === 0
        ? 'NO_CHARGES'
        : overdue > 0
          ? 'OVERDUE'
          : open > 0
            ? 'DUE'
            : 'PAID';
    return {
      unitId: u.id,
      unitRef: u.unitRef,
      label: u.label,
      buildingId: u.buildingId,
      buildingName: u.building ? (u.building.name ?? u.building.code) : null,
      occupancy: occ ? 'OCCUPIED' : 'VACANT',
      tenantId: occ?.tenantId ?? null,
      tenantName: occ?.tenantName ?? null,
      leaseId: occ?.leaseId ?? null,
      leaseEndsAt: occ?.leaseEndsAt ? occ.leaseEndsAt.toISOString().slice(0, 10) : null,
      monthlyRent: occ?.monthlyRent ?? '0',
      openBalance: open.toFixed(2),
      overdueBalance: overdue.toFixed(2),
      oldestDueDate: m?.oldest ? m.oldest.toISOString().slice(0, 10) : null,
      nextDueDate: m?.next ? m.next.toISOString().slice(0, 10) : null,
      currency: m?.currency ?? property.currency,
      state,
    };
  });

  const buildingMap = new Map<string, RentRollBuilding>();
  const totals: RentRollTotals = { units: 0, occupied: 0, vacant: 0, monthlyRent: '0', openBalance: '0', overdueBalance: '0' };
  const sum = { rent: 0, open: 0, overdue: 0 };
  for (const r of rows) {
    const key = r.buildingId ?? '__none__';
    const b =
      buildingMap.get(key) ??
      {
        buildingId: r.buildingId,
        name: r.buildingName ?? 'No building',
        units: 0,
        occupied: 0,
        vacant: 0,
        monthlyRent: '0',
        openBalance: '0',
        overdueBalance: '0',
      };
    b.units += 1;
    if (r.occupancy === 'OCCUPIED') b.occupied += 1;
    else b.vacant += 1;
    const bm = { rent: Number(b.monthlyRent), open: Number(b.openBalance), overdue: Number(b.overdueBalance) };
    bm.rent += Number(r.monthlyRent);
    bm.open += Number(r.openBalance);
    bm.overdue += Number(r.overdueBalance);
    b.monthlyRent = bm.rent.toFixed(2);
    b.openBalance = bm.open.toFixed(2);
    b.overdueBalance = bm.overdue.toFixed(2);
    buildingMap.set(key, b);

    totals.units += 1;
    if (r.occupancy === 'OCCUPIED') totals.occupied += 1;
    else totals.vacant += 1;
    sum.rent += Number(r.monthlyRent);
    sum.open += Number(r.openBalance);
    sum.overdue += Number(r.overdueBalance);
  }
  totals.monthlyRent = sum.rent.toFixed(2);
  totals.openBalance = sum.open.toFixed(2);
  totals.overdueBalance = sum.overdue.toFixed(2);

  return {
    property,
    totals,
    buildings: [...buildingMap.values()].sort((a, b) =>
      a.buildingId === null ? 1 : b.buildingId === null ? -1 : a.name.localeCompare(b.name),
    ),
    rows,
  };
}
