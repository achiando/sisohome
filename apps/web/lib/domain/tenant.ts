/**
 * Tenant domain service (plan-slice-2 §1/§2.1).
 *
 * Tenants are PARTY records, not property children: `organizationId` = the
 * org that CAPTURED them (leasing org — may differ from the portfolio org
 * when a PM leases on an owner's behalf). Reachable two ways:
 *   1. flat  — organizationId = actor.organizationId (you created them)
 *   2. through leases — LeaseTenant → lease.property passes propertyScope
 * Tenants are never scoped THROUGH the portfolio: PII stays with the
 * capturing org; a landlord sees a tenant only once that tenant is linked
 * to one of their properties via a lease (arm via property scope).
 *
 * Every read requires `tenant.read` (route layer) — PII is permission-gated,
 * never filtered client-side. Portal invite = hashed one-shot token
 * (SHA-256 at rest, 7-day expiry) + portalStatus flip; acceptance is slice 7.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { appUrl } from '@/lib/base-url';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import {
  CONTACT_CHANNEL_VALUES,
  TENANT_ID_TYPE_VALUES,
  TENANT_PARTY_TYPE_VALUES,
  TENANT_STATUS_VALUES,
} from './tenant-constants';

type Raw = Record<string, unknown>;

export const TENANT_INVITE_TTL_DAYS = 7;

// ── coercion helpers (same style as unit.ts) ─────────────────────────────────

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function strOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = str(v);
  return s === undefined ? null : s;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new RouteError(400, `Invalid ${field}`);
  return v as T;
}

function boolOrUndefined(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return undefined;
}

function dateOrNull(v: unknown, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new RouteError(400, `${field} must be a date`);
  return d;
}

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── scoping ──────────────────────────────────────────────────────────────────

/** Flat (own) OR through-lease (property-scoped) reachability. */
export function tenantScopeWhere(actor: ScopeActor): Prisma.TenantWhereInput {
  return {
    OR: [
      { organizationId: actor.organizationId },
      { leases: { some: { lease: { property: propertyScopeWhere(actor) } } } },
    ],
  };
}

// ── reads ────────────────────────────────────────────────────────────────────

export interface TenantListFilters {
  status?: string;
  q?: string;
  /** Restrict to tenants holding a lease on this property (property detail). */
  propertyId?: string;
}

export async function listTenants(actor: ScopeActor, filters: TenantListFilters = {}) {
  const where: Prisma.TenantWhereInput = { ...tenantScopeWhere(actor) };
  if (filters.propertyId) {
    // Scope the property through the parent scope — a cross-tenant id 404s.
    await requirePropertyInScope(actor, filters.propertyId);
    where.leases = { some: { lease: { propertyId: filters.propertyId } } };
  }
  const status = pick(filters.status, TENANT_STATUS_VALUES, 'status');
  if (status) where.status = status;
  const q = str(filters.q);
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { tenantRef: { contains: q, mode: 'insensitive' } },
    ];
  }
  const rows = await db.tenant.findMany({
    where,
    include: {
      leases: {
        include: { lease: { select: { id: true, status: true, startsAt: true, endsAt: true } } },
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { displayName: 'asc' },
  });
  // Directory never ships PII beyond the minimal columns the plan allows.
  return rows.map((t) => ({
    id: t.id,
    tenantRef: t.tenantRef,
    displayName: t.displayName,
    partyType: t.partyType,
    phone: t.phone,
    email: t.email,
    status: t.status,
    portalStatus: t.portalStatus,
    incomeVerified: t.incomeVerified,
    createdAt: t.createdAt,
    leases: t.leases.map((lt) => lt.lease),
  }));
}

export async function getTenant(actor: ScopeActor, id: string) {
  const tenant = await db.tenant.findFirst({
    where: { id, ...tenantScopeWhere(actor) },
    include: {
      leases: {
        include: {
          lease: {
            include: {
              property: { select: { id: true, name: true } },
              units: { include: { unit: { select: { id: true, unitRef: true, label: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      rentalApplications: {
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitRef: true, label: true } },
        },
        orderBy: { submittedAt: 'desc' },
      },
      portalInvites: {
        where: { usedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, email: true, expiresAt: true, createdAt: true },
      },
    },
  });
  if (!tenant) throw new RouteError(404, 'Tenant not found');
  return tenant;
}

// ── writes ───────────────────────────────────────────────────────────────────

function parseTenantInput(raw: Raw, partial = false): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  const displayName = str(raw.displayName);
  if (displayName !== undefined) data.displayName = displayName;
  const tenantRef = strOrNull(raw.tenantRef);
  if (tenantRef !== undefined) data.tenantRef = tenantRef;
  const email = strOrNull(raw.email);
  if (email !== undefined) data.email = email;
  const phone = strOrNull(raw.phone);
  if (phone !== undefined) data.phone = phone;
  const altPhone = strOrNull(raw.altPhone);
  if (altPhone !== undefined) data.altPhone = altPhone;
  const idNumber = strOrNull(raw.idNumber);
  if (idNumber !== undefined) data.idNumber = idNumber;
  const nationality = strOrNull(raw.nationality);
  if (nationality !== undefined) data.nationality = nationality;
  const kraPin = strOrNull(raw.kraPin);
  if (kraPin !== undefined) data.kraPin = kraPin;
  const employer = strOrNull(raw.employer);
  if (employer !== undefined) data.employer = employer;
  const jobTitle = strOrNull(raw.jobTitle);
  if (jobTitle !== undefined) data.jobTitle = jobTitle;
  const bankReference = strOrNull(raw.bankReference);
  if (bankReference !== undefined) data.bankReference = bankReference;
  const addressLine1 = strOrNull(raw.addressLine1);
  if (addressLine1 !== undefined) data.addressLine1 = addressLine1;
  const addressLine2 = strOrNull(raw.addressLine2);
  if (addressLine2 !== undefined) data.addressLine2 = addressLine2;
  const city = strOrNull(raw.city);
  if (city !== undefined) data.city = city;
  const postalAddress = strOrNull(raw.postalAddress);
  if (postalAddress !== undefined) data.postalAddress = postalAddress;
  const emergencyContactName = strOrNull(raw.emergencyContactName);
  if (emergencyContactName !== undefined) data.emergencyContactName = emergencyContactName;
  const emergencyContactRelationship = strOrNull(raw.emergencyContactRelationship);
  if (emergencyContactRelationship !== undefined) data.emergencyContactRelationship = emergencyContactRelationship;
  const emergencyContactPhone = strOrNull(raw.emergencyContactPhone);
  if (emergencyContactPhone !== undefined) data.emergencyContactPhone = emergencyContactPhone;
  const guarantorName = strOrNull(raw.guarantorName);
  if (guarantorName !== undefined) data.guarantorName = guarantorName;
  const guarantorPhone = strOrNull(raw.guarantorPhone);
  if (guarantorPhone !== undefined) data.guarantorPhone = guarantorPhone;
  const guarantorEmployer = strOrNull(raw.guarantorEmployer);
  if (guarantorEmployer !== undefined) data.guarantorEmployer = guarantorEmployer;
  const guarantorRelationship = strOrNull(raw.guarantorRelationship);
  if (guarantorRelationship !== undefined) data.guarantorRelationship = guarantorRelationship;
  const notes = strOrNull(raw.notes);
  if (notes !== undefined) data.notes = notes;

  const partyType = pick(raw.partyType, TENANT_PARTY_TYPE_VALUES, 'partyType');
  if (partyType !== undefined) data.partyType = partyType;
  const idType = pick(raw.idType, TENANT_ID_TYPE_VALUES, 'idType');
  if (idType !== undefined) data.idType = idType;
  const preferredChannel = pick(raw.preferredChannel, CONTACT_CHANNEL_VALUES, 'preferredChannel');
  if (preferredChannel !== undefined) data.preferredChannel = preferredChannel;
  const status = pick(raw.status, TENANT_STATUS_VALUES, 'status');
  if (status !== undefined) data.status = status;
  const incomeVerified = boolOrUndefined(raw.incomeVerified);
  if (incomeVerified !== undefined) data.incomeVerified = incomeVerified;
  const dateOfBirth = dateOrNull(raw.dateOfBirth, 'dateOfBirth');
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;

  if (!partial) {
    if (!displayName) throw new RouteError(400, 'displayName is required');
  }
  return data;
}

export async function createTenant(actor: ScopeActor, raw: Raw) {
  const data = parseTenantInput(raw);
  if (typeof data.displayName !== 'string') throw new RouteError(400, 'displayName is required');
  try {
    const tenant = await db.tenant.create({
      data: {
        ...(data as Prisma.TenantUncheckedCreateInput),
        // New parties are enquiries until screening/leases say otherwise; the
        // schema default (ACTIVE) predates the leasing lifecycle.
        status:
          typeof data.status === 'string' && (TENANT_STATUS_VALUES as readonly string[]).includes(data.status)
            ? (data.status as (typeof TENANT_STATUS_VALUES)[number])
            : 'PROSPECT',
        organizationId: actor.organizationId,
      },
    });
    await auditLog(actor, 'TENANT', 'tenant.create', tenant.id, {
      displayName: tenant.displayName,
    });
    return tenant;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RouteError(409, 'A tenant with this email or tenantRef already exists');
    }
    throw err;
  }
}

export async function updateTenant(actor: ScopeActor, id: string, raw: Raw) {
  const existing = await db.tenant.findFirst({
    where: { id, ...tenantScopeWhere(actor) },
    select: { id: true, organizationId: true, displayName: true },
  });
  if (!existing) throw new RouteError(404, 'Tenant not found');
  const data = parseTenantInput(raw, true);
  if (Object.keys(data).length === 0) throw new RouteError(400, 'No fields to update');
  try {
    const result = await db.tenant.updateMany({
      where: { id, organizationId: existing.organizationId },
      data,
    });
    if (result.count === 0) throw new RouteError(404, 'Tenant not found');
    await auditLog(actor, 'TENANT', 'tenant.update', id, { fields: Object.keys(data) });
    return db.tenant.findUniqueOrThrow({ where: { id } });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RouteError(409, 'A tenant with this email or tenantRef already exists');
    }
    throw err;
  }
}

export async function removeTenant(actor: ScopeActor, id: string) {
  const existing = await db.tenant.findFirst({
    where: { id, ...tenantScopeWhere(actor) },
    select: { id: true, organizationId: true, displayName: true },
  });
  if (!existing) throw new RouteError(404, 'Tenant not found');
  const [leaseLinks, applications] = await Promise.all([
    db.leaseTenant.count({ where: { tenantId: id } }),
    db.rentalApplication.count({ where: { applicantTenantId: id } }),
  ]);
  if (leaseLinks > 0 || applications > 0) {
    throw new RouteError(409, 'Tenant is linked to leases or applications and cannot be deleted');
  }
  const result = await db.tenant.deleteMany({
    where: { id, organizationId: existing.organizationId },
  });
  if (result.count === 0) throw new RouteError(404, 'Tenant not found');
  await auditLog(actor, 'TENANT', 'tenant.delete', id, { displayName: existing.displayName });
}

// ── portal invite ────────────────────────────────────────────────────────────

export async function inviteTenantToPortal(actor: ScopeActor, id: string, raw?: Raw) {
  const tenant = await db.tenant.findFirst({
    where: { id, ...tenantScopeWhere(actor) },
    select: { id: true, organizationId: true, displayName: true, email: true, portalStatus: true },
  });
  if (!tenant) throw new RouteError(404, 'Tenant not found');
  const email = str((raw as Raw | undefined)?.email) ?? str(tenant.email);
  if (!email) throw new RouteError(400, 'Tenant needs an email address before an invite can be sent');
  if (tenant.portalStatus === 'ACTIVE') {
    throw new RouteError(409, 'Tenant already has an active portal account');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TENANT_INVITE_TTL_DAYS * 86_400_000);
  // Invite row lives in the tenant's own (capturing) org; invalidate prior
  // outstanding invites so only the newest link works.
  await db.$transaction([
    db.tenantPortalInvite.deleteMany({ where: { tenantId: id, usedAt: null } }),
    db.tenantPortalInvite.create({
      data: {
        organizationId: tenant.organizationId,
        tenantId: id,
        email,
        tokenHash: hashInviteToken(token),
        expiresAt,
        invitedByUserId: actor.userId,
      },
    }),
    db.tenant.updateMany({
      where: { id, organizationId: tenant.organizationId },
      data: { portalStatus: 'INVITED', portalInvitedAt: new Date() },
    }),
  ]);

  const inviteUrl = `${appUrl()}/portal/accept?token=${token}`;
  await auditLog(actor, 'TENANT', 'tenant.portal_invite', id, { email });
  return { inviteUrl, expiresAt, email };
}

/** Invite-state values for the UI badge (revoke is slice 7). */
