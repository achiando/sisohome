/**
 * Type-name e-sign (People plan Slice 6) — previews and signing evidence.
 *
 * Flow (folded into the existing Approve dialogs):
 *   1. `preview*` renders the selected template with live entity data plus the
 *      acting user's account label — the exact text they must type back.
 *   2. `prepare*Sign` runs inside approve: validates template category and
 *      typed name, re-renders at signing time and fingerprints the HTML
 *      (sha256). The rendered text is NOT stored (evidence-only decision,
 *      STATUS §5): the PropertyDocument row carries a generated pointer
 *      (fileName/caption) and the hash + typed name land in the audit trail.
 *
 * Scope: leases resolve through `propertyScopeWhere`; management agreements
 * through the either-side rule (portfolio OR manager org), mirroring
 * `agreement.ts` — approval itself stays portfolio-only upstream.
 */

import type { Prisma } from '@workspace/database';
import type { DocumentEntityType, DocumentKind } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import {
  AGREEMENT_TEMPLATES,
  templateMeta,
  type AgreementPreviewResponse,
  type AgreementTemplateCategory,
} from './agreement-constants';
import {
  type LeaseTemplateContext,
  type ManagementTemplateContext,
  renderLeaseTemplate,
  renderManagementTemplate,
  sha256Hex,
} from './agreement-templates';

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

// ── signer identity ──────────────────────────────────────────────────────────

/** The account label the signer must type back (display name, else email). */
export async function signerLabelFor(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });
  const label = user?.displayName?.trim() || user?.email?.trim();
  if (!label) throw new RouteError(400, 'Your account has no name to sign with — set a display name first');
  return label;
}

function normalizeName(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Type-name e-sign: the typed string must match the account label. */
export function assertTypedName(signerLabel: string, raw: unknown): string {
  const typed = str(raw);
  if (!typed) throw new RouteError(400, 'Type your full name to sign');
  if (normalizeName(typed) !== normalizeName(signerLabel)) {
    throw new RouteError(400, `Type your name exactly as it appears: ${signerLabel}`);
  }
  return typed;
}

// ── context gathering ────────────────────────────────────────────────────────

async function gatherLeaseContext(actor: ScopeActor, leaseId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, property: propertyScopeWhere(actor) },
    include: {
      property: { select: { name: true, addressLine1: true, addressLine2: true, locality: true } },
      units: {
        include: { unit: { select: { label: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      parties: {
        include: { tenant: { select: { displayName: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  });
  if (!lease) throw new RouteError(404, 'Lease not found');
  const ownerOrg = await db.organization.findUnique({
    where: { id: lease.organizationId },
    select: { name: true },
  });
  const ctx: LeaseTemplateContext = {
    reference: lease.leaseRef ?? lease.id.slice(0, 8).toUpperCase(),
    tenureType: lease.tenureType,
    property: {
      name: lease.property.name,
      address: [lease.property.addressLine1, lease.property.addressLine2].filter(Boolean).join(', '),
      locality: lease.property.locality,
    },
    units: lease.units.map((u) => u.unit.label),
    unitRents: lease.units.map((u) => ({ label: u.unit.label, rent: u.monthlyRent.toString() })),
    tenants: lease.parties.map((p) => p.tenant.displayName),
    ownerName: ownerOrg?.name ?? 'Landlord / agent',
    startsAt: lease.startsAt,
    endsAt: lease.endsAt,
    currency: lease.currency,
    billingFrequency: lease.billingFrequency,
    depositMonths: lease.depositMonths?.toString() ?? null,
    noticeDays: lease.noticeDays,
    autoRenew: lease.autoRenew,
    terms: lease.terms,
  };
  return { lease, ctx };
}

/** MANAGER templates for PM orgs, MAINTAINER templates for maintenance orgs. */
function allowedCategory(kind: string | null): AgreementTemplateCategory {
  if (kind === 'MAINTENANCE_COMPANY') return 'MAINTAINER';
  if (kind === 'PROPERTY_MANAGEMENT') return 'MANAGER';
  throw new RouteError(400, 'This agreement has no signing template category');
}

async function gatherAgreementContext(actor: ScopeActor, agreementId: string) {
  const row = await db.propertyManagementAgreement.findFirst({
    where: {
      id: agreementId,
      OR: [{ organizationId: actor.organizationId }, { managementOrganizationId: actor.organizationId }],
    },
    include: {
      property: { select: { code: true, name: true, addressLine1: true, addressLine2: true, locality: true } },
      ownerParty: { select: { name: true } },
      managementOrganization: { select: { name: true, kind: true } },
    },
  });
  if (!row) throw new RouteError(404, 'Agreement not found');
  const scopeNotes =
    typeof row.scope === 'string'
      ? row.scope
      : row.scope
        ? JSON.stringify(row.scope, null, 2)
        : null;
  const ctx: ManagementTemplateContext = {
    reference: row.property.code ?? row.id.slice(0, 8).toUpperCase(),
    property: {
      name: row.property.name,
      address: [row.property.addressLine1, row.property.addressLine2].filter(Boolean).join(', '),
      locality: row.property.locality,
    },
    ownerName: row.ownerParty.name,
    managerName: row.managementOrganization.name,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    scopeNotes,
  };
  return { row, ctx };
}

// ── previews ─────────────────────────────────────────────────────────────────

export async function previewLeaseAgreement(
  actor: ScopeActor,
  leaseId: string,
  templateId?: string,
): Promise<AgreementPreviewResponse> {
  const { lease, ctx } = await gatherLeaseContext(actor, leaseId);
  const templates = AGREEMENT_TEMPLATES.filter((t) => t.category === 'TENANT');
  const defaultId = lease.tenureType === 'LICENSE' ? 'tenant-licence' : 'tenant-residential';
  const selected = templateId ?? defaultId;
  const meta = templates.find((t) => t.id === selected);
  if (!meta) throw new RouteError(400, `Unknown or wrong-category template: ${selected}`);
  const signerLabel = await signerLabelFor(actor.userId);
  const html = renderLeaseTemplate(meta.id, ctx, { signerLabel, signedAt: null });
  return { templates, templateId: meta.id, html, signerLabel };
}

export async function previewManagementAgreement(
  actor: ScopeActor,
  agreementId: string,
  templateId?: string,
): Promise<AgreementPreviewResponse> {
  const { row, ctx } = await gatherAgreementContext(actor, agreementId);
  const category = allowedCategory(row.managementOrganization.kind);
  const templates = AGREEMENT_TEMPLATES.filter((t) => t.category === category);
  const selected = templateId ?? templates[0]!.id;
  const meta = templates.find((t) => t.id === selected);
  if (!meta) throw new RouteError(400, `Unknown or wrong-category template: ${selected}`);
  const signerLabel = await signerLabelFor(actor.userId);
  const html = renderManagementTemplate(meta.id, ctx, { signerLabel, signedAt: null });
  return { templates, templateId: meta.id, html, signerLabel };
}

// ── signing (runs inside approve) ────────────────────────────────────────────

export interface PreparedSign {
  templateId: string;
  templateLabel: string;
  signerLabel: string;
  typedName: string;
  signedAt: Date;
  sha256: string;
  evidence: {
    entityType: DocumentEntityType;
    entityId: string;
    kind: DocumentKind;
    organizationId: string;
    propertyId: string;
    fileName: string;
    storageKey: string;
    caption: string;
  };
}

function requireSignInputs(raw: Raw | undefined): { templateId: string; typedRaw: string } {
  const templateId = str(raw?.template);
  const typedRaw = str(raw?.typedName);
  if (!templateId && !typedRaw) {
    throw new RouteError(400, 'template and typedName must both be provided to sign');
  }
  if (!templateId) throw new RouteError(400, 'template is required to sign');
  if (!typedRaw) throw new RouteError(400, 'Type your full name to sign');
  return { templateId, typedRaw };
}

export async function prepareLeaseSign(
  actor: ScopeActor,
  leaseId: string,
  raw: Raw | undefined,
  effectiveSignedAt: Date,
): Promise<PreparedSign> {
  const { templateId, typedRaw } = requireSignInputs(raw);
  const meta = templateMeta(templateId);
  if (!meta || meta.category !== 'TENANT') {
    throw new RouteError(400, `Unknown or wrong-category template: ${templateId}`);
  }
  const { lease, ctx } = await gatherLeaseContext(actor, leaseId);
  const signerLabel = await signerLabelFor(actor.userId);
  const typedName = assertTypedName(signerLabel, typedRaw);
  const signedAt = effectiveSignedAt;
  const html = renderLeaseTemplate(templateId, ctx, { signerLabel, signedAt });
  const hash = sha256Hex(html);
  return {
    templateId,
    templateLabel: meta.label,
    signerLabel,
    typedName,
    signedAt,
    sha256: hash,
    evidence: {
      entityType: 'LEASE',
      entityId: lease.id,
      kind: 'TENANCY_AGREEMENT',
      organizationId: lease.organizationId,
      propertyId: lease.propertyId,
      fileName: `${ctx.reference}-${templateId}.html`,
      storageKey: `generated/agreements/lease/${lease.id}/${templateId}`,
      caption: `Signed by ${signerLabel} · ${signedAt.toISOString().slice(0, 10)} · sha256 ${hash.slice(0, 16)}`,
    },
  };
}

export async function prepareAgreementSign(
  actor: ScopeActor,
  agreementId: string,
  raw: Raw | undefined,
): Promise<PreparedSign> {
  const { templateId, typedRaw } = requireSignInputs(raw);
  const { row, ctx } = await gatherAgreementContext(actor, agreementId);
  const category = allowedCategory(row.managementOrganization.kind);
  const meta = templateMeta(templateId);
  if (!meta || meta.category !== category) {
    throw new RouteError(400, `Template does not match this agreement (expected ${category}): ${templateId}`);
  }
  const signerLabel = await signerLabelFor(actor.userId);
  const typedName = assertTypedName(signerLabel, typedRaw);
  const signedAt = new Date();
  const html = renderManagementTemplate(templateId, ctx, { signerLabel, signedAt });
  const hash = sha256Hex(html);
  return {
    templateId,
    templateLabel: meta.label,
    signerLabel,
    typedName,
    signedAt,
    sha256: hash,
    evidence: {
      entityType: 'AGREEMENT',
      entityId: row.id,
      kind: 'CONTRACT',
      organizationId: row.organizationId,
      propertyId: row.propertyId,
      fileName: `${ctx.reference}-${templateId}.html`,
      storageKey: `generated/agreements/management/${row.id}/${templateId}`,
      caption: `Signed by ${signerLabel} · ${signedAt.toISOString().slice(0, 10)} · sha256 ${hash.slice(0, 16)}`,
    },
  };
}

/** Evidence row + baseline version — created inside the approve transaction. */
export async function createSignDocument(
  tx: Prisma.TransactionClient,
  sign: PreparedSign,
  uploadedBy: string,
) {
  const e = sign.evidence;
  const doc = await tx.propertyDocument.create({
    data: {
      organizationId: e.organizationId,
      propertyId: e.propertyId,
      entityType: e.entityType,
      entityId: e.entityId,
      kind: e.kind,
      storageKey: e.storageKey,
      fileName: e.fileName,
      mimeType: 'text/html',
      caption: e.caption,
    },
  });
  await tx.documentVersion.create({
    data: {
      documentId: doc.id,
      version: doc.version,
      storageKey: e.storageKey,
      fileName: e.fileName,
      mimeType: 'text/html',
      uploadedBy,
    },
  });
  return doc;
}

/** Compact audit payload shared by both approve paths. */
export function signAuditMeta(sign: PreparedSign, documentId: string) {
  return {
    template: sign.templateId,
    templateLabel: sign.templateLabel,
    signerLabel: sign.signerLabel,
    typedName: sign.typedName,
    signedAt: sign.signedAt.toISOString(),
    sha256: sign.sha256,
    documentId,
  };
}
