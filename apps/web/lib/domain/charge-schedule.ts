/**
 * Charge-schedule domain service — recurring bills attached to a UNIT
 * (waste, water, service charge…) outside the lease's rent.
 *
 * Rules:
 * - Schema XOR: exactly one of leaseId / propertyId / unitId. This module
 *   only manages the UNIT arm — rent stays lease-driven, property-level
 *   schedules are not exposed yet.
 * - Scope: the unit's property via `propertyScopeWhere`; a schedule can only
 *   be read/edited through a unit the actor may scope.
 * - RENT is rejected on create: use the lease for rent.
 * - Deactivate (isActive=false) is the soft path; DELETE detaches the row.
 */

import type { BillingFrequency, ChargeType, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { CHARGE_TYPE_LABELS, BILLING_FREQUENCY_LABELS } from './charge-constants';

type Raw = Record<string, unknown>;

const CHARGE_TYPES = Object.keys(CHARGE_TYPE_LABELS) as ChargeType[];
const FREQUENCIES = Object.keys(BILLING_FREQUENCY_LABELS) as BillingFrequency[];

// ── helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new RouteError(400, `${field} is required`);
  return v.trim();
}

function amount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RouteError(400, 'amount must be a non-negative number');
  return n;
}

function date(v: unknown, field: string): Date {
  const d = new Date(String(v ?? ''));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} is not a valid date`);
  return d;
}

function dateOrNull(v: unknown, field: string): Date | null {
  if (v === '' || v === null || v === undefined) return null;
  return date(v, field);
}

function pickEnum<T extends string>(v: unknown, allowed: T[], field: string, fallback?: T): T {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (!s) {
    if (fallback) return fallback;
    throw new RouteError(400, `${field} is required`);
  }
  if (!allowed.includes(s as T)) throw new RouteError(400, `${field} must be one of ${allowed.join(', ')}`);
  return s as T;
}

type ScheduleRow = Prisma.ChargeScheduleGetPayload<Record<string, never>>;

function shape(row: ScheduleRow) {
  return {
    id: row.id,
    unitId: row.unitId,
    name: row.name,
    chargeType: row.chargeType as string,
    amount: row.amount.toString(),
    currency: row.currency,
    frequency: row.frequency as string,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
  };
}

export type UnitScheduleRow = ReturnType<typeof shape>;

async function requireScheduleInScope(actor: ScopeActor, id: string): Promise<ScheduleRow> {
  const row = await db.chargeSchedule.findFirst({
    where: { id, organizationId: actor.organizationId, unitId: { not: null } },
    include: { unit: { select: { propertyId: true } } },
  });
  if (!row || !row.unit) throw new RouteError(404, 'Bill not found');
  const scoped = await db.property.findFirst({
    where: { id: row.unit.propertyId, ...propertyScopeWhere(actor) },
    select: { id: true },
  });
  if (!scoped) throw new RouteError(404, 'Bill not found');
  return row;
}

async function requireUnitInScope(
  actor: ScopeActor,
  unitId: string,
): Promise<{ id: string; propertyId: string; currency: string | null }> {
  const unit = await db.unit.findFirst({
    where: { id: unitId, property: propertyScopeWhere(actor) },
    select: { id: true, propertyId: true, currency: true },
  });
  if (!unit) throw new RouteError(404, 'Unit not found');
  return unit;
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listUnitSchedules(actor: ScopeActor, unitId: string): Promise<UnitScheduleRow[]> {
  await requireUnitInScope(actor, unitId);
  const rows = await db.chargeSchedule.findMany({
    where: { unitId, organizationId: actor.organizationId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return rows.map(shape);
}

// ── writes ───────────────────────────────────────────────────────────────────

export async function createUnitSchedule(actor: ScopeActor, unitId: string, raw: Raw) {
  const unit = await requireUnitInScope(actor, unitId);
  const name = str(raw.name, 'name');
  const chargeType = pickEnum<ChargeType>(raw.chargeType, CHARGE_TYPES, 'chargeType');
  if (chargeType === 'RENT') {
    throw new RouteError(400, 'Rent belongs to the lease — add other bills here');
  }
  const n = amount(raw.amount);
  const frequency = pickEnum<BillingFrequency>(raw.frequency, FREQUENCIES, 'frequency', 'MONTHLY');
  const startDate = date(raw.startDate, 'startDate');
  const endDate = dateOrNull(raw.endDate, 'endDate');
  if (endDate && endDate <= startDate) throw new RouteError(400, 'endDate must be after startDate');
  const currency = (
    typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency.trim() : (unit.currency ?? 'KES')
  ).toUpperCase();

  const row = await db.chargeSchedule.create({
    data: {
      organizationId: actor.organizationId,
      unitId,
      name,
      chargeType,
      amount: n,
      currency,
      frequency,
      startDate,
      endDate,
    },
  });
  await auditLog(actor, 'CHARGE_SCHEDULE', 'charge_schedule.create', row.id, {
    unitId,
    name,
    chargeType,
    amount: n,
    currency,
    frequency,
  });
  return shape(row);
}

export async function updateSchedule(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await requireScheduleInScope(actor, id);
  const data: Prisma.ChargeScheduleUpdateInput = {};
  if (raw.name !== undefined) data.name = str(raw.name, 'name');
  if (raw.chargeType !== undefined) {
    const t = pickEnum<ChargeType>(raw.chargeType, CHARGE_TYPES, 'chargeType');
    if (t === 'RENT') throw new RouteError(400, 'Rent belongs to the lease — add other bills here');
    data.chargeType = t;
  }
  if (raw.amount !== undefined) data.amount = amount(raw.amount);
  if (raw.frequency !== undefined) {
    data.frequency = pickEnum<BillingFrequency>(raw.frequency, FREQUENCIES, 'frequency');
  }
  if (raw.startDate !== undefined) data.startDate = date(raw.startDate, 'startDate');
  if (raw.endDate !== undefined) data.endDate = dateOrNull(raw.endDate, 'endDate');
  if (raw.isActive !== undefined) data.isActive = Boolean(raw.isActive);
  if (Object.keys(data).length === 0) throw new RouteError(400, 'No fields to update');

  const row = await db.chargeSchedule.update({ where: { id: existing.id }, data });
  await auditLog(actor, 'CHARGE_SCHEDULE', 'charge_schedule.update', row.id, {
    name: row.name,
    amount: row.amount.toString(),
    isActive: row.isActive,
    fields: Object.keys(data),
  });
  return shape(row);
}

export async function removeSchedule(actor: ScopeActor, id: string) {
  const existing = await requireScheduleInScope(actor, id);
  await db.chargeSchedule.delete({ where: { id: existing.id } });
  await auditLog(actor, 'CHARGE_SCHEDULE', 'charge_schedule.delete', existing.id, {
    unitId: existing.unitId,
    name: existing.name,
    amount: existing.amount.toString(),
  });
}
