/**
 * Public intake (self-onboarding) domain — people plan §5.
 *
 * A staff member with `application.create` mints a SIGNED, STATELESS link
 * (`/i/<token>`) for a property (optionally pre-bound to a unit). The
 * applicant opens it without a session, sees minimal property/unit context,
 * and submits their details. We then create:
 *
 *   - a Tenant (party) under the ISSUING org — the capture-org party rule:
 *     `organizationId` = the org that captured them (tenant.ts header);
 *   - a RentalApplication under the property's PORTFOLIO org (property-child
 *     rule, application.ts header), status SUBMITTED; the tenant flips
 *     PROSPECT → APPLICANT inside `createApplication`.
 *
 * Authorization model:
 *   - issue: real session + `application.create` + property scope (apiRoute).
 *   - use:   the token IS the capability. Signature (HMAC-SHA256) proves the
 *     server minted it; expiry caps replay. At resolve/submit time the
 *     issuer's property scope is RE-CHECKED so a link dies when the issuer
 *     loses access (agreement lapsed, staff assignment ended, property
 *     archived or gone) → 410, never a silent write into a revoked scope.
 *
 * Reuse: a returning applicant (same email, else same phone, inside the
 * issuing org) is matched to their existing Tenant instead of duplicating —
 * public input NEVER mutates existing PII. A second pre-decision application
 * on the same property is a 409.
 */

import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { appUrl } from '@/lib/base-url';
import { issueIntakeToken, verifyIntakeToken } from '@/lib/intake-token';
import { auditLog } from './audit';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';
import { createTenant } from './tenant';
import { createApplication } from './application';
import { APPLICATION_PRE_DECISION_STATUSES } from './application-constants';
import { TENANT_ID_TYPE_VALUES } from './tenant-constants';

type Raw = Record<string, unknown>;

export const INTAKE_DEFAULT_TTL_DAYS = 30;
export const INTAKE_MAX_TTL_DAYS = 90;
export const INTAKE_CONTEXT_MAX_AGE_DAYS = 90;

// ── input coercion ───────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

function parseIntakeInput(raw: Raw): {
  displayName: string;
  phone: string;
  email?: string;
  idType?: string;
  idNumber?: string;
} {
  const displayName = str(raw.displayName);
  if (!displayName) throw new RouteError(400, 'displayName is required');
  if (displayName.length > 200) throw new RouteError(400, 'displayName must be 200 characters or fewer');

  const phone = str(raw.phone);
  if (!phone) throw new RouteError(400, 'phone is required');
  if (phone.length > 40) throw new RouteError(400, 'phone must be 40 characters or fewer');
  if ((phone.replace(/\D/g, '').length < 7)) throw new RouteError(400, 'phone looks too short');

  const email = str(raw.email);
  if (email) {
    if (email.length > 254) throw new RouteError(400, 'email must be 254 characters or fewer');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RouteError(400, 'email is not a valid address');
  }

  const idType = str(raw.idType);
  if (idType && !(TENANT_ID_TYPE_VALUES as readonly string[]).includes(idType)) {
    throw new RouteError(400, 'Invalid idType');
  }
  const idNumber = str(raw.idNumber);
  if (idNumber && idNumber.length > 64) throw new RouteError(400, 'idNumber must be 64 characters or fewer');

  return {
    displayName,
    phone,
    ...(email ? { email } : {}),
    ...(idType ? { idType } : {}),
    ...(idNumber ? { idNumber } : {}),
  };
}

type IntakeInput = ReturnType<typeof parseIntakeInput>;

/**
 * Create the applicant's party row, or recover from a lost (org, email)
 * unique race by reusing the winner's row — the winner IS this applicant.
 * Always resolves to the tenant id or throws.
 */
async function createIntakeTenant(
  actor: ScopeActor,
  input: IntakeInput,
  organizationId: string,
): Promise<string> {
  try {
    const created = await createTenant(actor, input as Raw);
    return created.id;
  } catch (err) {
    if (err instanceof RouteError && err.status === 409 && input.email) {
      const raced = await db.tenant.findFirst({
        where: {
          organizationId,
          email: { equals: input.email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (raced) return raced.id;
    }
    throw err;
  }
}

// ── shared: verify token + re-check the issuer's property scope ──────────────

/**
 * The synthetic actor a signed token speaks for: issuing org + issuing user.
 * Scope arms 1/2/4 key on the org; arm 3 keys on the user — all four still
 * apply, so revoking the issuer's access revokes the link.
 */
function actorOf(payload: { o: string; by?: string }): ScopeActor {
  return { userId: payload.by ?? '', organizationId: payload.o };
}

async function loadScopedProperty(payload: { p: string; o: string; by?: string }) {
  const property = await db.property.findFirst({
    where: {
      id: payload.p,
      status: { not: 'ARCHIVED' },
      ...propertyScopeWhere(actorOf(payload)),
    },
    select: { id: true, name: true, locality: true, portfolioOrganizationId: true },
  });
  if (!property) {
    throw new RouteError(410, 'This link is no longer accepting applications.');
  }
  return property;
}

function verifyOrThrow(token: string | undefined) {
  const result = verifyIntakeToken(token);
  if (result.ok) return result.payload;
  if (result.reason === 'expired') {
    throw new RouteError(410, 'This link has expired. Ask your property manager for a new one.');
  }
  throw new RouteError(404, 'This intake link is invalid.');
}

/** Unit display info, or null when the pre-bound unit is gone / re-scoped. */
async function loadContextUnit(unitId: string | undefined, propertyId: string) {
  if (!unitId) return null;
  const unit = await db.unit.findFirst({
    where: { id: unitId, propertyId },
    select: { label: true, unitRef: true, defaultRent: true, currency: true },
  });
  if (!unit) return null;
  return {
    label: unit.label || unit.unitRef,
    rent: unit.defaultRent != null ? Number(unit.defaultRent) : null,
    currency: unit.currency ?? null,
  };
}

// ── issue (authenticated) ────────────────────────────────────────────────────

export async function issueIntakeLink(
  actor: ScopeActor,
  propertyId: string,
  raw: Raw = {},
) {
  const property = await requirePropertyInScope(actor, propertyId);

  const unitId = str(raw.unitId);
  if (unitId) {
    const unit = await db.unit.findFirst({
      where: { id: unitId, propertyId },
      select: { id: true },
    });
    if (!unit) throw new RouteError(400, 'unitId must belong to the selected property');
  }

  const ttlDaysRaw = raw.expiresInDays;
  let ttlDays = INTAKE_DEFAULT_TTL_DAYS;
  if (ttlDaysRaw !== undefined && ttlDaysRaw !== null && ttlDaysRaw !== '') {
    const n = Number(ttlDaysRaw);
    if (!Number.isInteger(n) || n < 1 || n > INTAKE_MAX_TTL_DAYS) {
      throw new RouteError(400, `expiresInDays must be an integer between 1 and ${INTAKE_MAX_TTL_DAYS}`);
    }
    ttlDays = n;
  }

  const ttlSeconds = ttlDays * 86_400;
  const token = issueIntakeToken({
    propertyId,
    ...(unitId ? { unitId } : {}),
    organizationId: actor.organizationId,
    issuedByUserId: actor.userId,
    ttlSeconds,
  });
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await auditLog(
    actor,
    'PROPERTY',
    'property.intake_link',
    propertyId,
    { unitId: unitId ?? null, ttlDays, expiresAt: expiresAt.toISOString() },
    property.portfolioOrganizationId,
  );

  return {
    token,
    url: `${appUrl()}/i/${token}`,
    expiresAt: expiresAt.toISOString(),
    ttlDays,
  };
}

// ── resolve (public GET) ─────────────────────────────────────────────────────

export interface IntakeContext {
  property: { name: string; locality: string };
  unit: { label: string; rent: number | null; currency: string | null } | null;
  expiresAt: string;
}

/** Minimal public display info for a valid, in-scope link. */
export async function resolveIntake(token: string | undefined): Promise<IntakeContext> {
  const payload = verifyOrThrow(token);
  const property = await loadScopedProperty(payload);
  const unit = await loadContextUnit(payload.u, property.id);
  return {
    property: { name: property.name, locality: property.locality },
    unit,
    expiresAt: new Date(payload.x * 1000).toISOString(),
  };
}

// ── submit (public POST) ─────────────────────────────────────────────────────

export interface IntakeSubmitResult {
  applicationId: string;
}

export async function submitIntake(
  token: string | undefined,
  raw: Raw,
): Promise<IntakeSubmitResult> {
  const payload = verifyOrThrow(token);
  const input = parseIntakeInput(raw);
  const actor = actorOf(payload);
  const property = await loadScopedProperty(payload);

  // Pre-bound unit may have been deleted after the link was issued — fall
  // back to a property-level application rather than failing the applicant.
  let unitId: string | null = null;
  if (payload.u) {
    const unit = await db.unit.findFirst({
      where: { id: payload.u, propertyId: property.id },
      select: { id: true },
    });
    unitId = unit?.id ?? null;
  }

  // Reuse an existing party in the ISSUING org (email first, else phone).
  // Public input never overwrites a matched record's PII.
  let existing = null;
  if (input.email) {
    existing = await db.tenant.findFirst({
      where: {
        organizationId: payload.o,
        email: { equals: input.email, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }
  if (!existing && input.phone) {
    existing = await db.tenant.findFirst({
      where: { organizationId: payload.o, phone: input.phone },
      select: { id: true },
    });
  }

  const tenantId = existing ? existing.id : await createIntakeTenant(actor, input, payload.o);

  // One live application per property per applicant.
  const liveApp = await db.rentalApplication.findFirst({
    where: {
      propertyId: property.id,
      applicantTenantId: tenantId,
      status: { in: [...APPLICATION_PRE_DECISION_STATUSES] },
    },
    select: { id: true },
  });
  if (liveApp) {
    throw new RouteError(409, 'An application for this property is already under review.');
  }

  const application = await createApplication(actor, {
    propertyId: property.id,
    ...(unitId ? { unitId } : {}),
    applicantTenantId: tenantId,
  });

  await auditLog(
    actor,
    'APPLICATION',
    'application.intake_submit',
    application.id,
    { via: 'intake_link', propertyId: property.id, unitId },
    property.portfolioOrganizationId,
  );

  return { applicationId: application.id };
}
