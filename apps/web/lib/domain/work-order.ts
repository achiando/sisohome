/**
 * Work-order domain service (plan-slice-3 §3) — including the cross-org
 * assignment hook: a portfolio org hands a job to a MAINTENANCE_COMPANY org
 * via `WorkOrderAssignment.assigneeOrganizationId`, no agreement required
 * (the assignment itself is the access grant).
 *
 * Scoping (plan §1 — symmetric):
 * - WO rows are property children → scope THROUGH `property: propertyScopeWhere`
 *   (MM reaches the property via arm 4: has an assignment).
 * - Assignment rows: `organizationId` = WO's portfolio org; MM matches via
 *   `assigneeOrganizationId`, portfolio via `organizationId`, person via
 *   `assigneeUserId` — all three arms allowed for row mutations.
 *
 * `?scope=mine` (rows assigned to the caller) is a UX filter, not a security
 * boundary — org-level isolation is the boundary (plan §1).
 */

import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import {
  propertyScopeWhere,
  requirePropertyInScope,
  type ScopeActor,
} from './property-scope';
import {
  ASSIGNMENT_TRANSITIONS,
  TICKET_PRIORITIES,
  WORK_ORDER_STATUS_VALUES,
  WORK_ORDER_TRANSITIONS,
  type WorkOrderStatusValue,
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

const PRIORITY_VALUES = TICKET_PRIORITIES.map((o) => o.value);

function dateOrNull(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a valid date`);
  return d;
}

/** Money → Decimal string; undefined = untouched, null = cleared. */
function moneyOrNull(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RouteError(400, `${field} must be a non-negative number`);
  return n.toFixed(2);
}

async function requireWorkOrderInScope(actor: ScopeActor, id: string) {
  const row = await db.workOrder.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      unitId: true,
      ticketId: true,
      status: true,
      title: true,
    },
  });
  if (!row) throw new RouteError(404, 'Work order not found');
  return row;
}

async function validateUnit(unitId: string | null | undefined, propertyId: string) {
  if (!unitId) return;
  const unit = await db.unit.findFirst({ where: { id: unitId, propertyId }, select: { id: true } });
  if (!unit) throw new RouteError(400, 'unitId must belong to the selected property');
}

const WO_INCLUDE = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitRef: true, label: true } },
  ticket: { select: { id: true, title: true, status: true } },
} as const;

// ── reads ────────────────────────────────────────────────────────────────────

export async function listWorkOrders(
  actor: ScopeActor,
  filters: { status?: string; propertyId?: string; scope?: string } = {},
) {
  const where: Prisma.WorkOrderWhereInput = { property: propertyScopeWhere(actor) };
  const status = pick(filters.status, WORK_ORDER_STATUS_VALUES, 'status');
  if (status) where.status = status as never;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  if (filters.scope === 'mine') {
    // UX filter — rows assigned to the caller (plan §1).
    where.assignments = { some: { assigneeUserId: actor.userId } };
  }
  return db.workOrder.findMany({
    where,
    include: {
      ...WO_INCLUDE,
      assignments: {
        include: {
          assigneeUser: { select: { id: true, displayName: true } },
          assigneeOrganization: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function getWorkOrder(
  actor: ScopeActor,
  id: string,
  opts: { includeAssigneeContacts?: boolean } = {},
) {
  const userSelect = opts.includeAssigneeContacts
    ? { select: { id: true, displayName: true, email: true, phone: true } }
    : { select: { id: true, displayName: true } };
  const row = await db.workOrder.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      ...WO_INCLUDE,
      assignments: {
        orderBy: { assignedAt: 'desc' },
        include: {
          assigneeUser: userSelect,
          assigneeOrganization: { select: { id: true, name: true } },
        },
      },
      inspections: {
        orderBy: { scheduledFor: 'asc' },
        include: { inspector: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!row) throw new RouteError(404, 'Work order not found');
  return row;
}

// ── create / update ──────────────────────────────────────────────────────────

export async function createWorkOrder(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const title = str(raw.title);
  if (!title) throw new RouteError(400, 'title is required');

  const unitId = str(raw.unitId) ?? null;
  await validateUnit(unitId, propertyId);

  // Standalone WO (no ticket) is allowed; a linked ticket must be in scope
  // AND on the same property (plan §3).
  const ticketId = str(raw.ticketId) ?? null;
  if (ticketId) {
    const ticket = await db.maintenanceTicket.findFirst({
      where: { id: ticketId, property: propertyScopeWhere(actor) },
      select: { propertyId: true },
    });
    if (!ticket) throw new RouteError(404, 'Maintenance ticket not found');
    if (ticket.propertyId !== propertyId) {
      throw new RouteError(400, 'ticketId must belong to the selected property');
    }
  }

  const estimatedCost = moneyOrNull(raw.estimatedCost, 'estimatedCost');
  const currency = str(raw.currency)?.toUpperCase() ?? 'KES';
  if (currency.length !== 3) throw new RouteError(400, 'currency must be a 3-letter code');

  const created = await db.workOrder.create({
    data: {
      organizationId: property.portfolioOrganizationId,
      propertyId,
      unitId,
      ticketId,
      title,
      description: str(raw.description) ?? null,
      priority: (pick(raw.priority, PRIORITY_VALUES, 'priority') ?? 'MEDIUM') as never,
      status: 'PENDING',
      estimatedCost: estimatedCost ?? undefined,
      currency,
      scheduledFor: dateOrNull(raw.scheduledFor, 'scheduledFor') ?? null,
    },
  });
  await auditLog(
    actor,
    'WORK_ORDER',
    'work_order.create',
    created.id,
    { propertyId, ticketId },
    property.portfolioOrganizationId,
  );
  return created;
}

export async function updateWorkOrder(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await requireWorkOrderInScope(actor, id);
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new RouteError(409, `A ${existing.status.toLowerCase()} work order cannot be edited`);
  }

  const data: Prisma.WorkOrderUpdateManyMutationInput = {};
  let nextUnitId: string | null | undefined;
  if ('title' in raw) {
    const title = str(raw.title);
    if (!title) throw new RouteError(400, 'title is required');
    data.title = title;
  }
  if ('description' in raw) data.description = str(raw.description) ?? null;
  if ('priority' in raw) data.priority = (pick(raw.priority, PRIORITY_VALUES, 'priority') ?? 'MEDIUM') as never;
  if ('scheduledFor' in raw) data.scheduledFor = dateOrNull(raw.scheduledFor, 'scheduledFor');
  if ('estimatedCost' in raw) data.estimatedCost = moneyOrNull(raw.estimatedCost, 'estimatedCost');
  if ('finalCost' in raw) data.finalCost = moneyOrNull(raw.finalCost, 'finalCost');
  if ('currency' in raw) {
    const currency = str(raw.currency)?.toUpperCase();
    if (!currency || currency.length !== 3) throw new RouteError(400, 'currency must be a 3-letter code');
    data.currency = currency;
  }
  if ('unitId' in raw) {
    nextUnitId = str(raw.unitId) ?? null;
    await validateUnit(nextUnitId, existing.propertyId);
  }
  if (Object.keys(data).length === 0 && nextUnitId === undefined) {
    throw new RouteError(400, 'No fields to update');
  }

  const result = await db.workOrder.updateMany({
    where: { id, organizationId: existing.organizationId },
    data,
  });
  if (result.count === 0) throw new RouteError(404, 'Work order not found');
  if (nextUnitId !== undefined) {
    await db.workOrder.update({ where: { id }, data: { unitId: nextUnitId } });
  }
  const fieldNames = [...Object.keys(data), ...(nextUnitId !== undefined ? ['unitId'] : [])];
  await auditLog(actor, 'WORK_ORDER', 'work_order.update', id, { fields: fieldNames }, existing.organizationId);
  return getWorkOrder(actor, id, { includeAssigneeContacts: true });
}

// ── lifecycle ────────────────────────────────────────────────────────────────

/**
 * Shared transition engine for the `authorize` and `transition` routes.
 * Side effects: AUTHORIZED stamps authorizedAt/by + flips the linked ticket
 * to IN_PROGRESS; COMPLETED stamps completedAt (+optional finalCost) and
 * auto-completes every open assignment (array transaction — no callback, so
 * the global client isn't used mid-transaction).
 */
export async function transitionWorkOrder(actor: ScopeActor, id: string, raw: Raw) {
  const to = str(raw.to)?.toUpperCase();
  if (!to) throw new RouteError(400, 'to is required');
  const existing = await requireWorkOrderInScope(actor, id);

  const allowed = WORK_ORDER_TRANSITIONS[existing.status as WorkOrderStatusValue] ?? [];
  if (!(allowed as string[]).includes(to)) {
    throw new RouteError(409, `Work order cannot move from ${existing.status} to ${to}`);
  }

  const data: Prisma.WorkOrderUpdateManyMutationInput = { status: to as never };

  if (to === 'AUTHORIZED') {
    data.authorizedAt = new Date();
    data.authorizedByUserId = actor.userId;
  }
  if (to === 'COMPLETED') {
    data.completedAt = new Date();
    const finalCost = moneyOrNull(raw.finalCost, 'finalCost');
    if (finalCost !== undefined) data.finalCost = finalCost;
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    db.workOrder.updateMany({
      where: { id, organizationId: existing.organizationId, status: existing.status },
      data,
    }),
  ];

  // Ticket auto-escalation: ON WO AUTHORIZED the ticket moves to IN_PROGRESS
  // (plan §2) — only from a live ticket state (updateMany guards it).
  if (to === 'AUTHORIZED' && existing.ticketId) {
    ops.push(
      db.maintenanceTicket.updateMany({
        where: {
          id: existing.ticketId,
          status: { in: ['OPEN', 'ON_HOLD'] },
        },
        data: { status: 'IN_PROGRESS' },
      }),
    );
  }

  // COMPLETED closes out every open assignment (plan §3).
  if (to === 'COMPLETED') {
    ops.push(
      db.workOrderAssignment.updateMany({
        where: { workOrderId: id, status: 'ASSIGNED' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    );
  }

  const [woResult] = (await db.$transaction(ops)) as [{ count: number }, ...unknown[]];
  if (woResult.count === 0) throw new RouteError(409, 'Work order status changed — reload and retry');

  await auditLog(actor, 'WORK_ORDER', `work_order.${to === 'AUTHORIZED' ? 'authorize' : 'transition'}`, id, { from: existing.status, to }, existing.organizationId);
  return getWorkOrder(actor, id, { includeAssigneeContacts: true });
}

// ── cross-org assignment (the MM hook) ───────────────────────────────────────

export async function assignWorkOrder(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await requireWorkOrderInScope(actor, id);
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    throw new RouteError(409, `A ${existing.status.toLowerCase()} work order cannot be assigned`);
  }

  const assigneeUserId = str(raw.assigneeUserId);
  if (!assigneeUserId) throw new RouteError(400, 'assigneeUserId is required');

  // Target org: explicit (external MM company) or the actor's own org.
  // No agreement check — the assignment itself is the access grant (plan §3).
  const assigneeOrganizationId = str(raw.assigneeOrganizationId) ?? actor.organizationId;
  const member = await db.organizationMember.findFirst({
    where: { userId: assigneeUserId, organizationId: assigneeOrganizationId },
    select: { id: true },
  });
  if (!member) {
    throw new RouteError(400, 'Assignee must be a member of the selected organization');
  }

  const alreadyActive = await db.workOrderAssignment.findFirst({
    where: {
      workOrderId: id,
      assigneeUserId,
      status: 'ASSIGNED',
    },
    select: { id: true },
  });
  if (alreadyActive) throw new RouteError(409, 'This user already has an open assignment on the work order');

  const created = await db.workOrderAssignment.create({
    data: {
      organizationId: existing.organizationId,
      workOrderId: id,
      assigneeUserId,
      // Null when same-org — the FK is documented as "different org only".
      assigneeOrganizationId:
        assigneeOrganizationId === existing.organizationId ? null : assigneeOrganizationId,
      assignedByUserId: actor.userId,
      status: 'ASSIGNED',
    },
    include: {
      assigneeUser: { select: { id: true, displayName: true, email: true } },
      assigneeOrganization: { select: { id: true, name: true } },
    },
  });
  await auditLog(
    actor,
    'WORK_ORDER_ASSIGNMENT',
    'work_order.assign',
    id,
    { assigneeUserId, assigneeOrganizationId },
    existing.organizationId,
  );
  return created;
}

/**
 * Assign-dialog candidates (plan §6 open item, resolved):
 * - `organizations`: orgs this org already relates to for work — agreement
 *   counterparties (either side) + orgs on prior assignments (both
 *   directions). Free-form third parties are deliberately absent: an
 *   assignment grants property reach, so the relationship must pre-exist.
 * - `members`: ACTIVE members of the caller's org, or of a related org when
 *   `organizationId` is passed (404 when that org isn't related).
 */
export async function listAssigneeCandidates(
  actor: ScopeActor,
  organizationId?: string | null,
): Promise<{
  organizations: { id: string; name: string; kind: string | null }[];
  members: { userId: string; name: string; email: string }[];
}> {
  const [agreements, outAssignments, inAssignments] = await Promise.all([
    db.propertyManagementAgreement.findMany({
      where: {
        OR: [
          { organizationId: actor.organizationId },
          { managementOrganizationId: actor.organizationId },
        ],
      },
      select: { organizationId: true, managementOrganizationId: true },
    }),
    db.workOrderAssignment.findMany({
      where: { organizationId: actor.organizationId },
      select: { assigneeOrganizationId: true },
    }),
    db.workOrderAssignment.findMany({
      where: { assigneeOrganizationId: actor.organizationId },
      select: { organizationId: true },
    }),
  ]);

  const related = new Set<string>();
  for (const a of agreements) {
    if (a.organizationId !== actor.organizationId) related.add(a.organizationId);
    if (a.managementOrganizationId && a.managementOrganizationId !== actor.organizationId) {
      related.add(a.managementOrganizationId);
    }
  }
  for (const r of outAssignments) {
    if (r.assigneeOrganizationId && r.assigneeOrganizationId !== actor.organizationId) {
      related.add(r.assigneeOrganizationId);
    }
  }
  for (const r of inAssignments) {
    if (r.organizationId !== actor.organizationId) related.add(r.organizationId);
  }

  const organizations = related.size
    ? await db.organization.findMany({
        where: { id: { in: [...related] }, status: 'ACTIVE' },
        select: { id: true, name: true, kind: true },
        orderBy: { name: 'asc' },
      })
    : [];

  let members: { userId: string; name: string; email: string }[];
  if (organizationId && organizationId !== actor.organizationId) {
    if (!related.has(organizationId)) {
      throw new RouteError(404, 'Organization is not available for assignment');
    }
    const rows = await db.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { userId: true, user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    members = rows.map((m) => ({ userId: m.userId, name: m.user.displayName ?? m.user.email, email: m.user.email }));
  } else {
    const rows = await db.organizationMember.findMany({
      where: { organizationId: actor.organizationId, status: 'ACTIVE' },
      select: { userId: true, user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    members = rows.map((m) => ({ userId: m.userId, name: m.user.displayName ?? m.user.email, email: m.user.email }));
  }

  return { organizations, members };
}

/**
 * Assignment status moves (DECLINED/COMPLETED) — reachable from the
 * portfolio org, the assignee org, OR the assignee person (symmetric,
 * plan §1). COMPLETED stamps completedAt.
 */
export async function updateAssignment(actor: ScopeActor, assignmentId: string, raw: Raw) {
  const to = str(raw.status)?.toUpperCase() ?? str(raw.to)?.toUpperCase();
  if (to !== 'DECLINED' && to !== 'COMPLETED') {
    throw new RouteError(400, "status must be 'DECLINED' or 'COMPLETED'");
  }

  const row = await db.workOrderAssignment.findFirst({
    where: {
      id: assignmentId,
      OR: [
        { organizationId: actor.organizationId },
        { assigneeOrganizationId: actor.organizationId },
        { assigneeUserId: actor.userId },
      ],
    },
    select: { id: true, status: true, workOrderId: true, organizationId: true },
  });
  if (!row) throw new RouteError(404, 'Assignment not found');

  const allowed = ASSIGNMENT_TRANSITIONS[row.status as keyof typeof ASSIGNMENT_TRANSITIONS] ?? [];
  if (!(allowed as string[]).includes(to)) {
    throw new RouteError(409, `Assignment cannot move from ${row.status} to ${to}`);
  }

  const result = await db.workOrderAssignment.updateMany({
    where: { id: assignmentId, status: 'ASSIGNED' },
    data: { status: to as never, completedAt: to === 'COMPLETED' ? new Date() : null },
  });
  if (result.count === 0) throw new RouteError(409, 'Assignment already finished — reload and retry');

  await auditLog(
    actor,
    'WORK_ORDER_ASSIGNMENT',
    `work_order.assignment.${to.toLowerCase()}`,
    assignmentId,
    { workOrderId: row.workOrderId, to },
    row.organizationId,
  );
  return db.workOrderAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      assigneeUser: { select: { id: true, displayName: true } },
      assigneeOrganization: { select: { id: true, name: true } },
    },
  });
}
