/**
 * Maintenance domain service — tickets, inspections, recurring schedules
 * (plan-slice-3 §3).
 *
 * Scoping: ALL of these are property children — rows carry the property's
 * `portfolioOrganizationId` and scope THROUGH the parent
 * (`property: propertyScopeWhere`), so MM orgs reach them via arm 4
 * (assigned work order) or arm 2 (agreement). Mutations fetch → assert
 * parent scope → `updateMany({ where: { id, organizationId: <row's own> } })`.
 *
 * Person scoping (`?scope=mine`) is a UX filter, not a security boundary
 * (plan §1): org-level isolation is the security boundary; technicians get
 * their own view defaulted in the UI.
 */

import type { InspectionStatus, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import {
  propertyScopeWhere,
  requirePropertyInScope,
  type ScopeActor,
} from './property-scope';
import {
  INSPECTION_KINDS,
  INSPECTION_STATUS_VALUES,
  MAINTENANCE_STATUS_VALUES,
  SCHEDULE_FREQUENCY_VALUES,
  SCHEDULE_KINDS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TRANSITIONS,
  INSPECTION_TRANSITIONS,
  computeNextDue,
  type ScheduleFrequencyValue,
} from './maintenance-constants';

type Raw = Record<string, unknown>;

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

const CATEGORY_VALUES = TICKET_CATEGORIES.map((o) => o.value);
const PRIORITY_VALUES = TICKET_PRIORITIES.map((o) => o.value);
const INSPECTION_KIND_VALUES = INSPECTION_KINDS.map((o) => o.value);
const SCHEDULE_KIND_VALUES = SCHEDULE_KINDS.map((o) => o.value);

function dateOrNull(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

function dateRequired(v: unknown, field: string): Date {
  const d = dateOrNull(v, field);
  if (d === undefined || d === null) throw new RouteError(400, `${field} is required`);
  return d;
}

async function requireTicketInScope(actor: ScopeActor, id: string) {
  const row = await db.maintenanceTicket.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      unitId: true,
      status: true,
      title: true,
      priority: true,
    },
  });
  if (!row) throw new RouteError(404, 'Maintenance ticket not found');
  return row;
}

/** unitId must belong to the given property (400 otherwise). */
async function validateUnit(unitId: string | null | undefined, propertyId: string) {
  if (!unitId) return;
  const unit = await db.unit.findFirst({
    where: { id: unitId, propertyId },
    select: { id: true },
  });
  if (!unit) throw new RouteError(400, 'unitId must belong to the selected property');
}

/** Inspector/assignee must be a member of your org or the property's portfolio org. */
async function assertOrgMember(userId: string, organizationIds: string[], label: string) {
  const member = await db.organizationMember.findFirst({
    where: { userId, organizationId: { in: organizationIds } },
    select: { id: true },
  });
  if (!member) throw new RouteError(400, `${label} must be a member of your organization`);
}

// ══ TICKETS ═════════════════════════════════════════════════════════════════

export async function listTickets(
  actor: ScopeActor,
  filters: { status?: string; priority?: string; category?: string; propertyId?: string } = {},
) {
  const where: Prisma.MaintenanceTicketWhereInput = {
    property: propertyScopeWhere(actor),
  };
  const status = pick(filters.status, MAINTENANCE_STATUS_VALUES, 'status');
  const priority = pick(filters.priority, PRIORITY_VALUES, 'priority');
  const category = pick(filters.category, CATEGORY_VALUES, 'category');
  if (status) where.status = status as never;
  if (priority) where.priority = priority as never;
  if (category) where.category = category as never;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  return db.maintenanceTicket.findMany({
    where,
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      workOrders: {
        select: {
          id: true,
          status: true,
          title: true,
          assignments: {
            select: {
              assigneeOrganizationId: true,
              status: true,
              assigneeOrganization: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ reportedAt: 'desc' }],
  });
}

export async function getTicket(
  actor: ScopeActor,
  id: string,
  opts: { includeAssigneeContacts?: boolean } = {},
) {
  const userSelect = opts.includeAssigneeContacts
    ? { select: { id: true, displayName: true, email: true, phone: true } }
    : { select: { id: true, displayName: true } };
  const row = await db.maintenanceTicket.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      reportedByTenant: { select: { id: true, displayName: true, email: true, phone: true } },
      workOrders: {
        orderBy: { createdAt: 'asc' },
        include: {
          assignments: {
            include: {
              assigneeUser: userSelect,
              assigneeOrganization: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!row) throw new RouteError(404, 'Maintenance ticket not found');
  return row;
}

export async function createTicket(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const title = str(raw.title);
  if (!title) throw new RouteError(400, 'title is required');

  const unitId = str(raw.unitId) ?? null;
  await validateUnit(unitId, propertyId);

  const reportedByTenantId = str(raw.reportedByTenantId) ?? null;
  if (reportedByTenantId) {
    const tenant = await db.tenant.findFirst({
      where: { id: reportedByTenantId },
      select: { id: true, organizationId: true },
    });
    if (!tenant) throw new RouteError(404, 'Tenant not found');
  }

  const created = await db.maintenanceTicket.create({
    data: {
      organizationId: property.portfolioOrganizationId,
      propertyId,
      unitId,
      title,
      description: str(raw.description) ?? null,
      category: (pick(raw.category, CATEGORY_VALUES, 'category') ?? 'GENERAL') as never,
      priority: (pick(raw.priority, PRIORITY_VALUES, 'priority') ?? 'MEDIUM') as never,
      reportedByUserId: actor.userId,
      reportedByTenantId,
    },
  });
  await auditLog(
    actor,
    'MAINTENANCE_TICKET',
    'maintenance.ticket.create',
    created.id,
    { propertyId, priority: created.priority },
    property.portfolioOrganizationId,
  );
  return created;
}

export async function updateTicket(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await requireTicketInScope(actor, id);

  const data: Prisma.MaintenanceTicketUpdateManyMutationInput = {};
  let nextUnitId: string | null | undefined;
  if ('title' in raw) {
    const title = str(raw.title);
    if (!title) throw new RouteError(400, 'title is required');
    data.title = title;
  }
  if ('description' in raw) data.description = str(raw.description) ?? null;
  if ('category' in raw) data.category = (pick(raw.category, CATEGORY_VALUES, 'category') ?? 'GENERAL') as never;
  if ('priority' in raw) data.priority = (pick(raw.priority, PRIORITY_VALUES, 'priority') ?? 'MEDIUM') as never;
  if ('unitId' in raw) {
    nextUnitId = str(raw.unitId) ?? null;
    await validateUnit(nextUnitId, existing.propertyId);
  }
  if (Object.keys(data).length === 0 && nextUnitId === undefined) {
    throw new RouteError(400, 'No fields to update');
  }

  // Terminal states don't get edited back open through the form.
  if (existing.status === 'CLOSED' || existing.status === 'CANCELLED') {
    throw new RouteError(409, `A ${existing.status.toLowerCase()} ticket cannot be edited`);
  }

  const result = await db.maintenanceTicket.updateMany({
    where: { id, organizationId: existing.organizationId },
    data,
  });
  if (result.count === 0) throw new RouteError(404, 'Maintenance ticket not found');
  // unitId is a relation FK (omitted from updateMany input) — separate update.
  if (nextUnitId !== undefined) {
    await db.maintenanceTicket.update({ where: { id }, data: { unitId: nextUnitId } });
  }
  const fieldNames = [...Object.keys(data), ...(nextUnitId !== undefined ? ['unitId'] : [])];
  await auditLog(actor, 'MAINTENANCE_TICKET', 'maintenance.ticket.update', id, { fields: fieldNames }, existing.organizationId);
  return db.maintenanceTicket.findUniqueOrThrow({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
    },
  });
}

export async function transitionTicket(actor: ScopeActor, id: string, raw: Raw) {
  const to = str(raw.to)?.toUpperCase();
  if (!to) throw new RouteError(400, 'to is required');
  const existing = await requireTicketInScope(actor, id);

  const allowed = TICKET_TRANSITIONS[existing.status as keyof typeof TICKET_TRANSITIONS] ?? [];
  if (!(allowed as string[]).includes(to)) {
    throw new RouteError(409, `Ticket cannot move from ${existing.status} to ${to}`);
  }

  const data: Prisma.MaintenanceTicketUpdateManyMutationInput = { status: to as never };
  if (to === 'RESOLVED') data.resolvedAt = new Date();
  if (to === 'CLOSED') data.closedAt = new Date();
  if (existing.status === 'RESOLVED' && to !== 'RESOLVED') data.resolvedAt = null; // reopen

  const result = await db.maintenanceTicket.updateMany({
    where: { id, organizationId: existing.organizationId, status: existing.status },
    data,
  });
  if (result.count === 0) throw new RouteError(409, 'Ticket status changed — reload and retry');
  await auditLog(actor, 'MAINTENANCE_TICKET', 'maintenance.ticket.transition', id, { from: existing.status, to }, existing.organizationId);
  return db.maintenanceTicket.findUniqueOrThrow({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
    },
  });
}

// ══ INSPECTIONS ═════════════════════════════════════════════════════════════

export async function listInspections(
  actor: ScopeActor,
  filters: { status?: string; kind?: string; propertyId?: string } = {},
) {
  const where: Prisma.InspectionWhereInput = { property: propertyScopeWhere(actor) };
  const inspStatus = pick(filters.status, INSPECTION_STATUS_VALUES, 'status');
  const inspKind = pick(filters.kind, INSPECTION_KIND_VALUES, 'kind');
  if (inspStatus) where.status = inspStatus as never;
  if (inspKind) where.kind = inspKind as never;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  return db.inspection.findMany({
    where,
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      inspector: { select: { id: true, displayName: true } },
      workOrder: { select: { id: true, title: true, status: true } },
    },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getInspection(actor: ScopeActor, id: string) {
  const row = await db.inspection.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      inspector: { select: { id: true, displayName: true, email: true } },
      workOrder: { select: { id: true, title: true, status: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Inspection not found');
  return row;
}

async function assertInspector(inspectorUserId: string, actor: ScopeActor, portfolioOrgId: string) {
  await assertOrgMember(inspectorUserId, [actor.organizationId, portfolioOrgId], 'Inspector');
}

async function validateWorkOrder(workOrderId: string | null | undefined, actor: ScopeActor, propertyId: string) {
  if (!workOrderId) return;
  const wo = await db.workOrder.findFirst({
    where: { id: workOrderId, property: propertyScopeWhere(actor) },
    select: { propertyId: true },
  });
  if (!wo) throw new RouteError(404, 'Work order not found');
  if (wo.propertyId !== propertyId) throw new RouteError(400, 'workOrderId must belong to the selected property');
}

export async function createInspection(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const unitId = str(raw.unitId) ?? null;
  await validateUnit(unitId, propertyId);
  const workOrderId = str(raw.workOrderId) ?? null;
  await validateWorkOrder(workOrderId, actor, propertyId);

  const inspectorUserId = str(raw.inspectorUserId) ?? actor.userId;
  await assertInspector(inspectorUserId, actor, property.portfolioOrganizationId);

  const created = await db.inspection.create({
    data: {
      organizationId: property.portfolioOrganizationId,
      propertyId,
      unitId,
      workOrderId,
      kind: (pick(raw.kind, INSPECTION_KIND_VALUES, 'kind') ?? 'ROUTINE') as never,
      status: 'SCHEDULED',
      scheduledFor: dateOrNull(raw.scheduledFor, 'scheduledFor') ?? null,
      inspectorUserId,
    },
  });
  await auditLog(
    actor,
    'INSPECTION',
    'inspection.create',
    created.id,
    { propertyId, kind: created.kind },
    property.portfolioOrganizationId,
  );
  return created;
}

export async function updateInspection(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await db.inspection.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, propertyId: true, status: true },
  });
  if (!existing) throw new RouteError(404, 'Inspection not found');
  if ((['PASSED', 'FAILED', 'CANCELLED'] as InspectionStatus[]).includes(existing.status)) {
    throw new RouteError(409, 'A finished inspection cannot be edited');
  }

  const data: Prisma.InspectionUpdateManyMutationInput = {};
  let nextInspectorId: string | undefined;
  if ('status' in raw) {
    // SCHEDULED → IN_PROGRESS / CANCELLED rides the PATCH; PASSED/FAILED
    // require the /complete route (findings validation lives there).
    const to = str(raw.status)?.toUpperCase();
    if (to !== 'IN_PROGRESS' && to !== 'CANCELLED') {
      throw new RouteError(400, "status must be 'IN_PROGRESS' or 'CANCELLED' — use /complete for PASSED/FAILED");
    }
    const allowed = INSPECTION_TRANSITIONS[existing.status as keyof typeof INSPECTION_TRANSITIONS] ?? [];
    if (!(allowed as string[]).includes(to)) {
      throw new RouteError(409, `Inspection cannot move from ${existing.status} to ${to}`);
    }
    data.status = to as never;
  }
  if ('kind' in raw) data.kind = (pick(raw.kind, INSPECTION_KIND_VALUES, 'kind') ?? 'ROUTINE') as never;
  if ('scheduledFor' in raw) data.scheduledFor = dateOrNull(raw.scheduledFor, 'scheduledFor');
  if ('findings' in raw) data.findings = str(raw.findings) ?? null;
  if ('inspectorUserId' in raw) {
    const inspector = str(raw.inspectorUserId);
    if (!inspector) throw new RouteError(400, 'inspectorUserId is required');
    await assertInspector(inspector, actor, existing.organizationId);
    nextInspectorId = inspector; // relation FK — set via a separate update below
  }
  if (Object.keys(data).length === 0 && nextInspectorId === undefined) {
    throw new RouteError(400, 'No fields to update');
  }

  const result = await db.inspection.updateMany({
    where: { id, organizationId: existing.organizationId },
    data,
  });
  if (result.count === 0) throw new RouteError(404, 'Inspection not found');
  if (nextInspectorId) {
    await db.inspection.update({ where: { id }, data: { inspectorUserId: nextInspectorId } });
  }
  const fieldNames = [...Object.keys(data), ...(nextInspectorId ? ['inspectorUserId'] : [])];
  await auditLog(actor, 'INSPECTION', 'inspection.update', id, { fields: fieldNames }, existing.organizationId);
  return getInspection(actor, id);
}

/** Record findings — PASSED/FAILED; FAILED requires findings (plan §3). */
export async function completeInspection(actor: ScopeActor, id: string, raw: Raw) {
  const to = str(raw.to)?.toUpperCase() ?? str(raw.status)?.toUpperCase();
  if (to !== 'PASSED' && to !== 'FAILED') {
    throw new RouteError(400, "status must be 'PASSED' or 'FAILED'");
  }
  const existing = await db.inspection.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, status: true },
  });
  if (!existing) throw new RouteError(404, 'Inspection not found');

  const allowed = INSPECTION_TRANSITIONS[existing.status as keyof typeof INSPECTION_TRANSITIONS] ?? [];
  if (!(allowed as string[]).includes(to)) {
    throw new RouteError(409, `Inspection cannot move from ${existing.status} to ${to}`);
  }

  const findings = str(raw.findings) ?? null;
  if (to === 'FAILED' && !findings) {
    throw new RouteError(400, 'findings are required when an inspection fails');
  }

  const result = await db.inspection.updateMany({
    where: { id, organizationId: existing.organizationId, status: existing.status },
    data: { status: to as never, completedAt: new Date(), findings },
  });
  if (result.count === 0) throw new RouteError(409, 'Inspection status changed — reload and retry');
  await auditLog(actor, 'INSPECTION', 'inspection.complete', id, { from: existing.status, to }, existing.organizationId);
  return getInspection(actor, id);
}

// ── RECURRING SCHEDULES ─────────────────────────────────────────────────────

/**
 * `RecurringSchedule` has no `assignee` relation (just a nullable FK) —
 * resolve display names with a small manual join.
 */
async function withScheduleAssignee<T extends { assigneeUserId: string | null }>(rows: T[]) {
  const userIds = [...new Set(rows.map((r) => r.assigneeUserId).filter((v): v is string => Boolean(v)))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, assignee: r.assigneeUserId ? (byId.get(r.assigneeUserId) ?? null) : null }));
}

export async function listSchedules(
  actor: ScopeActor,
  filters: { propertyId?: string; active?: string } = {},
) {
  const where: Prisma.RecurringScheduleWhereInput = { property: propertyScopeWhere(actor) };
  if (filters.active === 'false') where.isActive = false;
  if (filters.active === 'true') where.isActive = true;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  const rows = await db.recurringSchedule.findMany({
    where,
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
    },
    orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'desc' }],
  });
  return withScheduleAssignee(rows);
}

export async function getSchedule(actor: ScopeActor, id: string) {
  const row = await db.recurringSchedule.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Schedule not found');
  const [withAssignee] = await withScheduleAssignee([row]);
  return withAssignee;
}

function parseFrequency(v: unknown): ScheduleFrequencyValue {
  const f = str(v)?.toUpperCase();
  if (!f || !(SCHEDULE_FREQUENCY_VALUES as readonly string[]).includes(f)) {
    throw new RouteError(400, 'frequency must be DAILY, WEEKLY, MONTHLY or QUARTERLY');
  }
  return f as ScheduleFrequencyValue;
}

export async function createSchedule(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const title = str(raw.title);
  if (!title) throw new RouteError(400, 'title is required');
  const startDate = dateRequired(raw.startDate, 'startDate');
  const frequency = parseFrequency(raw.frequency);

  const unitId = str(raw.unitId) ?? null;
  await validateUnit(unitId, propertyId);

  const assigneeUserId = str(raw.assigneeUserId) ?? null;
  if (assigneeUserId) {
    await assertOrgMember(assigneeUserId, [actor.organizationId, property.portfolioOrganizationId], 'Assignee');
  }

  const endDate = dateOrNull(raw.endDate, 'endDate') ?? null;
  const created = await db.recurringSchedule.create({
    data: {
      organizationId: property.portfolioOrganizationId,
      propertyId,
      unitId,
      title,
      kind: (pick(raw.kind, SCHEDULE_KIND_VALUES, 'kind') ?? 'OTHER') as never,
      frequency: frequency as never,
      startDate,
      endDate,
      nextDueAt: computeNextDue(startDate, frequency),
      assigneeUserId,
      isActive: true,
    },
  });
  await auditLog(
    actor,
    'RECURRING_SCHEDULE',
    'schedule.create',
    created.id,
    { propertyId, frequency },
    property.portfolioOrganizationId,
  );
  return created;
}

export async function updateSchedule(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await db.recurringSchedule.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, propertyId: true, frequency: true, startDate: true },
  });
  if (!existing) throw new RouteError(404, 'Schedule not found');

  const data: Prisma.RecurringScheduleUpdateManyMutationInput = {};
  if ('title' in raw) {
    const title = str(raw.title);
    if (!title) throw new RouteError(400, 'title is required');
    data.title = title;
  }
  if ('kind' in raw) data.kind = (pick(raw.kind, SCHEDULE_KIND_VALUES, 'kind') ?? 'OTHER') as never;
  if ('endDate' in raw) data.endDate = dateOrNull(raw.endDate, 'endDate');
  if ('isActive' in raw) {
    const v = raw.isActive;
    data.isActive = typeof v === 'boolean' ? v : v === 'true' || v === '1';
  }
  if ('assigneeUserId' in raw) {
    const assignee = str(raw.assigneeUserId) ?? null;
    if (assignee) {
      await assertOrgMember(assignee, [actor.organizationId, existing.organizationId], 'Assignee');
    }
    data.assigneeUserId = assignee;
  }

  // Frequency / start edits recompute next due (plan §3).
  let nextDueAt: Date | undefined;
  if ('frequency' in raw || 'startDate' in raw) {
    const frequency = 'frequency' in raw ? parseFrequency(raw.frequency) : (existing.frequency as ScheduleFrequencyValue);
    const startDate = 'startDate' in raw ? dateRequired(raw.startDate, 'startDate') : existing.startDate;
    if ('frequency' in raw) data.frequency = frequency as never;
    if ('startDate' in raw) data.startDate = startDate;
    nextDueAt = computeNextDue(startDate, frequency);
  }
  if (Object.keys(data).length === 0 && nextDueAt === undefined) {
    throw new RouteError(400, 'No fields to update');
  }

  const result = await db.recurringSchedule.updateMany({
    where: { id, organizationId: existing.organizationId },
    data,
  });
  if (result.count === 0) throw new RouteError(404, 'Schedule not found');
  if (nextDueAt !== undefined) {
    await db.recurringSchedule.update({ where: { id }, data: { nextDueAt } });
  }
  await auditLog(actor, 'RECURRING_SCHEDULE', 'schedule.update', id, { fields: Object.keys(data) }, existing.organizationId);
  return getSchedule(actor, id);
}

/** DELETE = soft-deactivate (recurring history kept, plan §3). */
export async function deactivateSchedule(actor: ScopeActor, id: string) {
  const existing = await db.recurringSchedule.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: { id: true, organizationId: true, isActive: true },
  });
  if (!existing) throw new RouteError(404, 'Schedule not found');
  if (!existing.isActive) return { id, isActive: false }; // idempotent

  const result = await db.recurringSchedule.updateMany({
    where: { id, organizationId: existing.organizationId },
    data: { isActive: false },
  });
  if (result.count === 0) throw new RouteError(404, 'Schedule not found');
  await auditLog(actor, 'RECURRING_SCHEDULE', 'schedule.deactivate', id, {}, existing.organizationId);
  return { id, isActive: false };
}
