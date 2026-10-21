/**
 * Rental application domain service (plan-slice-2 §2.2).
 *
 * Applications ARE property children: scope THROUGH the parent
 * (`property: propertyScopeWhere`) and key mutations by the row's OWN
 * `organizationId` (the property's portfolio org — a PM capturing an
 * application creates it under the owner's portfolio, matching the
 * property-child rule).
 *
 * Applicant PII: the list always ships contact-minimal; the detail route
 * upgrades to full PII only when the caller also holds `tenant.read`
 * (checked in the route via authorizationService).
 */

import type { ApplicationStatus, Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { auditLog } from './audit';
import {
  propertyScopeWhere,
  requirePropertyInScope,
  type ScopeActor,
} from './property-scope';
import { tenantScopeWhere } from './tenant';
import { APPLICATION_PRE_DECISION_STATUSES } from './application-constants';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function boolOrNull(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 'false') return v === 'true';
  return null;
}

const APPLICANT_MINIMAL = {
  select: { id: true, displayName: true, email: true, phone: true, status: true },
} as const;

async function requireApplicationInScope(actor: ScopeActor, id: string) {
  const row = await db.rentalApplication.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      unitId: true,
      applicantTenantId: true,
      status: true,
      decidedAt: true,
    },
  });
  if (!row) throw new RouteError(404, 'Application not found');
  return row;
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listApplications(
  actor: ScopeActor,
  filters: { status?: string; propertyId?: string } = {},
) {
  const where: Prisma.RentalApplicationWhereInput = {
    property: propertyScopeWhere(actor),
  };
  const status = str(filters.status);
  if (status) where.status = status as ApplicationStatus;
  if (filters.propertyId) {
    await requirePropertyInScope(actor, filters.propertyId);
    where.propertyId = filters.propertyId;
  }
  return db.rentalApplication.findMany({
    where,
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      applicant: APPLICANT_MINIMAL,
    },
    orderBy: { submittedAt: 'desc' },
  });
}

export async function getApplication(
  actor: ScopeActor,
  id: string,
  opts: { includeTenantPii?: boolean } = {},
) {
  const row = await db.rentalApplication.findFirst({
    where: { id, property: propertyScopeWhere(actor) },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      applicant: opts.includeTenantPii
        ? true
        : APPLICANT_MINIMAL,
    },
  });
  if (!row) throw new RouteError(404, 'Application not found');
  return row;
}

// ── writes ───────────────────────────────────────────────────────────────────

export async function createApplication(actor: ScopeActor, raw: Raw) {
  const propertyId = str(raw.propertyId);
  if (!propertyId) throw new RouteError(400, 'propertyId is required');
  const property = await requirePropertyInScope(actor, propertyId);

  const applicantTenantId = str(raw.applicantTenantId);
  if (!applicantTenantId) throw new RouteError(400, 'applicantTenantId is required');
  const applicant = await db.tenant.findFirst({
    where: { id: applicantTenantId, ...tenantScopeWhere(actor) },
    select: { id: true },
  });
  if (!applicant) throw new RouteError(404, 'Tenant not found');

  const unitId = str(raw.unitId) ?? null;
  if (unitId) {
    const unit = await db.unit.findFirst({
      where: { id: unitId, propertyId },
      select: { id: true },
    });
    if (!unit) throw new RouteError(400, 'unitId must belong to the selected property');
  }

  const internalNotes = str(raw.internalNotes) ?? null;
  const created = await db.rentalApplication.create({
    data: {
      organizationId: property.portfolioOrganizationId,
      propertyId,
      unitId,
      applicantTenantId,
      status: 'SUBMITTED',
      internalNotes,
    },
  });
  // Applicant moves to APPLICANT so the directory reflects screening state.
  await db.tenant.updateMany({
    where: { id: applicantTenantId, status: 'PROSPECT' },
    data: { status: 'APPLICANT' },
  });
  await auditLog(
    actor,
    'APPLICATION',
    'application.create',
    created.id,
    { propertyId, applicantTenantId },
    property.portfolioOrganizationId,
  );
  return created;
}

export async function updateApplication(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await requireApplicationInScope(actor, id);
  if (existing.decidedAt) throw new RouteError(409, 'Application already has a decision');

  const data: Prisma.RentalApplicationUpdateManyMutationInput = {};
  let nextUnitId: string | null | undefined;
  if ('internalNotes' in raw) data.internalNotes = str(raw.internalNotes) ?? null;
  if ('incomeVerified' in raw) {
    const v = boolOrNull(raw.incomeVerified);
    if (v === null) throw new RouteError(400, 'incomeVerified must be a boolean');
    data.incomeVerified = v;
  }
  if ('unitId' in raw) {
    nextUnitId = str(raw.unitId) ?? null;
    if (nextUnitId) {
      const unit = await db.unit.findFirst({
        where: { id: nextUnitId, propertyId: existing.propertyId },
        select: { id: true },
      });
      if (!unit) throw new RouteError(400, 'unitId must belong to the application property');
    }
  }
  if ('status' in raw) {
    const status = str(raw.status);
    if (!status || !(APPLICATION_PRE_DECISION_STATUSES as readonly string[]).includes(status)) {
      throw new RouteError(400, 'Status can only be SUBMITTED or SCREENING before a decision');
    }
    data.status = status as 'SUBMITTED' | 'SCREENING';
  }
  if (Object.keys(data).length === 0 && nextUnitId === undefined) {
    throw new RouteError(400, 'No fields to update');
  }

  // unitId is a relation FK, which Prisma's updateMany input omits — set it
  // via a separate update after the scalar updateMany (row already verified
  // in scope above).
  const result = await db.rentalApplication.updateMany({
    where: { id, organizationId: existing.organizationId },
    data,
  });
  if (result.count === 0) throw new RouteError(404, 'Application not found');
  if (nextUnitId !== undefined) {
    await db.rentalApplication.update({ where: { id }, data: { unitId: nextUnitId } });
  }
  const fieldNames = [...Object.keys(data), ...(nextUnitId !== undefined ? ['unitId'] : [])];
  await auditLog(actor, 'APPLICATION', 'application.update', id, { fields: fieldNames }, existing.organizationId);
  return db.rentalApplication.findUniqueOrThrow({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      applicant: APPLICANT_MINIMAL,
    },
  });
}

export async function decideApplication(
  actor: ScopeActor,
  id: string,
  raw: Raw,
) {
  const decision = str(raw.decision)?.toUpperCase();
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw new RouteError(400, "decision must be 'APPROVED' or 'REJECTED'");
  }
  const existing = await requireApplicationInScope(actor, id);
  if (existing.decidedAt) throw new RouteError(409, 'Application already has a decision');

  const status = decision === 'APPROVED' ? 'APPROVED' : 'DENIED';
  const data: Prisma.RentalApplicationUpdateManyMutationInput = {
    status,
    decidedAt: new Date(),
    decidedByUserId: actor.userId,
  };

  // Optional link to a lease created ahead of the decision ("approve & start
  // lease" navigates to the wizard; linking happens on the lease itself or
  // via a follow-up PATCH — record it here when provided and in scope).
  const leaseId = str(raw.leaseId);
  if (leaseId) {
    const lease = await db.lease.findFirst({
      where: { id: leaseId, property: propertyScopeWhere(actor) },
      select: { id: true },
    });
    if (!lease) throw new RouteError(404, 'Lease not found');
    data.leaseId = leaseId;
  }

  const result = await db.rentalApplication.updateMany({
    where: { id, organizationId: existing.organizationId, decidedAt: null },
    data,
  });
  if (result.count === 0) throw new RouteError(409, 'Application already has a decision');

  if (status === 'APPROVED') {
    await db.tenant.updateMany({
      where: { id: existing.applicantTenantId },
      data: { status: 'ACTIVE' },
    });
  }

  await auditLog(
    actor,
    'APPLICATION',
    status === 'APPROVED' ? 'application.approve' : 'application.reject',
    id,
    { status, leaseId: leaseId ?? null },
    existing.organizationId,
  );
  return db.rentalApplication.findUniqueOrThrow({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitRef: true, label: true } },
      applicant: APPLICANT_MINIMAL,
    },
  });
}
