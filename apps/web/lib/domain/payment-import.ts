/**
 * Payment-source import pipeline (roadmap Phase 1) — parse → match →
 * preview → commit.
 *
 *   preview: adapter.parse + match against tenants/units/open charges — NO
 *            writes (the browser can hit Preview as often as it likes).
 *   commit:  re-parses the same paste server-side (the client never dictates
 *            parsed content), persists batch + rows, and applies checked
 *            rows through `recordMultiMonthPayment` — the claim-confirm
 *            allocation path — stamping `externalId` + `source: 'IMPORT'`.
 *
 * Matching signals (locked decision #4: abstraction first, M-Pesa SMS is
 * just the first adapter):
 *   - sender phone  → tenant.phone / tenant.altPhone (normalized MSISDN)
 *   - account text  → unitRef / leaseRef → active tenancy
 *   - amount vs the candidate's open charge balance (fits = allocatable)
 *   - externalId/reference dedupe against Payment + PaymentClaim (+ in-batch)
 * Confidence: two corroborating signals + allocatable amount → MATCHED
 * (pre-checked in the preview); a single signal → AMBIGUOUS (needs a
 * glance); nothing → UNMATCHED (manual tenant picker).
 */
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { getPaymentSourceAdapter, type ParsedPayment } from '@/lib/payments/adapter';
import { normalizeMsisdn } from '@/lib/payments/mpesa-sms';
import { auditLog } from './audit';
import { recordMultiMonthPayment } from './monthly';
import { propertyScopeWhere, type ScopeActor } from './property-scope';

export type ImportRowStatus =
  | 'MATCHED'
  | 'AMBIGUOUS'
  | 'UNMATCHED'
  | 'DUPLICATE'
  | 'APPLIED';
export type ImportAccountType = 'RENT' | 'UTILITIES';

const EPS = 1; // KES tolerance for "amount fits the open balance"

export interface PreviewMatched {
  tenantId: string;
  tenantName: string;
  leaseId: string | null;
  unitId: string | null;
  unitRef: string | null;
  propertyId: string;
  openRent: string;
  openUtilities: string;
}

export interface PreviewRow {
  index: number;
  raw: string;
  amount: number | null;
  currency: string;
  reference: string | null;
  externalId: string | null;
  senderPhone: string | null;
  paidAt: string | null;
  status: ImportRowStatus;
  accountType: ImportAccountType;
  confidence: number;
  /** MATCHED rows come pre-checked in the preview. */
  preChecked: boolean;
  matched: PreviewMatched | null;
  duplicateOf: 'payment' | 'claim' | 'batch' | null;
}

export interface ImportDecision {
  index: number;
  checked: boolean;
  tenantId?: string;
  accountType?: ImportAccountType;
}

/** One tenancy's open charges — the anchor a committed payment records against. */
interface AnchorGroup {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  leaseId: string | null;
  unitId: string | null;
  unitRef: string | null;
  openRent: number;
  openUtilities: number;
}

interface MatchContext {
  tenantIdsByPhone: Map<string, string[]>;
  tenantsById: Map<string, { id: string; displayName: string }>;
  unitByRef: Map<string, { id: string; propertyId: string }>;
  leaseByRef: Map<
    string,
    {
      id: string;
      propertyId: string;
      primaryTenantId: string | null;
      firstUnitId: string | null;
    }
  >;
  /** unitId → active tenancy (for account-ref matches). */
  activeByUnit: Map<string, { tenantId: string; leaseId: string; propertyId: string }>;
  /** Anchor groups per tenant, best-open-balance first. */
  groupsByTenant: Map<string, AnchorGroup[]>;
  usedExternalIds: Set<string>;
  usedReferences: Set<string>;
  /** Subset of the used identifiers that came from a PaymentClaim (attribution). */
  claimedIdentifiers: Set<string>;
}

const money = (n: number) => n.toFixed(2);

function bucketOf(chargeType: string): ImportAccountType {
  return chargeType === 'RENT' ? 'RENT' : 'UTILITIES';
}

async function buildMatchContext(
  actor: ScopeActor,
  parsed: ParsedPayment[],
): Promise<MatchContext> {
  const [tenants, units, leases, charges] = await Promise.all([
    db.tenant.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, displayName: true, phone: true, altPhone: true },
    }),
    db.unit.findMany({
      where: { organizationId: actor.organizationId, property: propertyScopeWhere(actor) },
      select: { id: true, unitRef: true, propertyId: true },
    }),
    db.lease.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        leaseRef: true,
        propertyId: true,
        units: { select: { unitId: true }, take: 1, orderBy: { unitId: 'asc' } },
        parties: {
          where: { relationship: 'PRIMARY' },
          take: 1,
          select: { tenantId: true },
        },
      },
    }),
    db.charge.findMany({
      where: {
        organizationId: actor.organizationId,
        property: propertyScopeWhere(actor),
        postedAt: { not: null },
      },
      select: {
        tenantId: true,
        leaseId: true,
        unitId: true,
        propertyId: true,
        chargeType: true,
        amount: true,
        billingPeriodStart: true,
        allocations: { select: { amount: true } },
      },
    }),
  ]);

  // ── phone → tenant(s) ──
  const tenantIdsByPhone = new Map<string, string[]>();
  const tenantsById = new Map<string, { id: string; displayName: string }>();
  for (const t of tenants) {
    tenantsById.set(t.id, { id: t.id, displayName: t.displayName });
    for (const raw of [t.phone, t.altPhone]) {
      if (!raw) continue;
      const norm = normalizeMsisdn(raw);
      if (!norm) continue;
      const list = tenantIdsByPhone.get(norm) ?? [];
      if (!list.includes(t.id)) list.push(t.id);
      tenantIdsByPhone.set(norm, list);
    }
  }

  const unitByRef = new Map<string, { id: string; propertyId: string }>();
  for (const u of units) unitByRef.set(u.unitRef.toLowerCase(), { id: u.id, propertyId: u.propertyId });

  const leaseByRef: MatchContext['leaseByRef'] = new Map();
  for (const l of leases) {
    if (!l.leaseRef) continue;
    leaseByRef.set(l.leaseRef.toLowerCase(), {
      id: l.id,
      propertyId: l.propertyId,
      primaryTenantId: l.parties[0]?.tenantId ?? null,
      firstUnitId: l.units[0]?.unitId ?? null,
    });
  }

  // ── active tenancy per unit (only for units referenced by this batch) ──
  const wantedUnitIds = new Set<string>();
  for (const p of parsed) {
    const ref = p.reference?.toLowerCase();
    if (!ref) continue;
    const unit = unitByRef.get(ref);
    if (unit) wantedUnitIds.add(unit.id);
  }
  const activeByUnit: MatchContext['activeByUnit'] = new Map();
  if (wantedUnitIds.size > 0) {
    const activeLeases = await db.lease.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: ['ACTIVE', 'ENDING'] },
        units: { some: { unitId: { in: [...wantedUnitIds] } } },
      },
      select: {
        id: true,
        propertyId: true,
        startsAt: true,
        units: { select: { unitId: true } },
        parties: {
          where: { relationship: 'PRIMARY' },
          take: 1,
          select: { tenantId: true },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
    for (const l of activeLeases) {
      const tenantId = l.parties[0]?.tenantId;
      if (!tenantId) continue;
      for (const lu of l.units) {
        if (!activeByUnit.has(lu.unitId)) {
          activeByUnit.set(lu.unitId, { tenantId, leaseId: l.id, propertyId: l.propertyId });
        }
      }
    }
  }

  // ── open charges → anchor groups per tenancy ──
  const groupsByTenant: Map<string, AnchorGroup[]> = new Map();
  const partial = new Map<
    string,
    {
      tenantId: string;
      propertyId: string;
      leaseId: string | null;
      unitId: string | null;
      openRent: number;
      openUtilities: number;
    }
  >();
  for (const c of charges) {
    if (!c.tenantId || !c.billingPeriodStart) continue;
    const balance =
      Number(c.amount) - c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    if (balance <= 0.009) continue;
    const key = `${c.tenantId}|${c.propertyId}|${c.leaseId ?? '-'}|${c.unitId ?? '-'}`;
    let g = partial.get(key);
    if (!g) {
      g = {
        tenantId: c.tenantId,
        propertyId: c.propertyId,
        leaseId: c.leaseId,
        unitId: c.unitId,
        openRent: 0,
        openUtilities: 0,
      };
      partial.set(key, g);
    }
    if (bucketOf(c.chargeType) === 'RENT') g.openRent += balance;
    else g.openUtilities += balance;
  }
  for (const g of partial.values()) {
    const unitRef = g.unitId ? (units.find((u) => u.id === g.unitId)?.unitRef ?? null) : null;
    const tenantName = tenantsById.get(g.tenantId)?.displayName ?? '';
    const list = groupsByTenant.get(g.tenantId) ?? [];
    list.push({ ...g, unitRef, tenantName });
    groupsByTenant.set(g.tenantId, list);
  }
  // Best first: a group that can absorb the first parsed amount comes first
  // so later lookups prefer the allocatable tenancy; then by open total.
  const firstAmount = parsed[0]?.amount ?? 0;
  for (const list of groupsByTenant.values()) {
    list.sort((a, b) => {
      const aFit = Math.max(a.openRent, a.openUtilities) + EPS >= firstAmount ? 1 : 0;
      const bFit = Math.max(b.openRent, b.openUtilities) + EPS >= firstAmount ? 1 : 0;
      if (aFit !== bFit) return bFit - aFit;
      return b.openRent + b.openUtilities - (a.openRent + a.openUtilities);
    });
  }

  // ── dedupe sets: identifiers already used by Payment / PaymentClaim ──
  // `usedExternalIds` = receipt codes (payments.externalId, code typed as a
  // payment reference, claim references). `usedReferences` = non-code
  // reference text already recorded — only consulted for rows WITHOUT a
  // receipt code, so an account/unit ref never fakes a duplicate on a
  // fresh M-Pesa code.
  const batchCodes = [
    ...new Set(parsed.map((p) => p.externalId).filter((c): c is string => Boolean(c))),
  ];
  const batchRefs = [
    ...new Set(parsed.map((p) => p.reference).filter((c): c is string => Boolean(c))),
  ];
  const codeOrRef = [...new Set([...batchCodes, ...batchRefs])];
  const usedExternalIds = new Set<string>();
  const usedReferences = new Set<string>();
  const claimedIdentifiers = new Set<string>();
  if (codeOrRef.length > 0) {
    const [payments, claims] = await Promise.all([
      db.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          OR: [{ externalId: { in: batchCodes } }, { reference: { in: codeOrRef } }],
        },
        select: { externalId: true, reference: true },
        take: 200,
      }),
      db.paymentClaim.findMany({
        where: {
          organizationId: actor.organizationId,
          status: { not: 'REJECTED' },
          reference: { in: codeOrRef },
        },
        select: { reference: true },
        take: 200,
      }),
    ]);
    for (const p of payments) {
      if (p.externalId) usedExternalIds.add(p.externalId);
      if (p.reference) {
        if (batchCodes.includes(p.reference)) usedExternalIds.add(p.reference);
        else usedReferences.add(p.reference);
      }
    }
    for (const c of claims) {
      if (!c.reference) continue;
      if (batchCodes.includes(c.reference)) usedExternalIds.add(c.reference);
      else usedReferences.add(c.reference);
      claimedIdentifiers.add(c.reference);
    }
  }

  return {
    tenantIdsByPhone,
    tenantsById,
    unitByRef,
    leaseByRef,
    activeByUnit,
    groupsByTenant,
    usedExternalIds,
    usedReferences,
    claimedIdentifiers,
  };
}

/** Best anchor group for a tenant relative to the row amount, + bucket + fits. */
function pickGroup(
  ctx: MatchContext,
  tenantId: string,
  amount: number | null,
): { group: AnchorGroup | null; accountType: ImportAccountType; fits: boolean } {
  const groups = ctx.groupsByTenant.get(tenantId) ?? [];
  if (groups.length === 0) return { group: null, accountType: 'RENT', fits: false };
  if (amount == null) {
    const g = groups[0]!;
    return {
      group: g,
      accountType: g.openRent > 0 ? 'RENT' : 'UTILITIES',
      fits: false,
    };
  }
  const fitsRent = groups.find((g) => g.openRent + EPS >= amount);
  if (fitsRent && fitsRent.openRent > 0) {
    return { group: fitsRent, accountType: 'RENT', fits: true };
  }
  const fitsUtil = groups.find((g) => g.openUtilities + EPS >= amount);
  if (fitsUtil && fitsUtil.openUtilities > 0) {
    return { group: fitsUtil, accountType: 'UTILITIES', fits: true };
  }
  const anyOpen = groups.find((g) => g.openRent > 0 || g.openUtilities > 0);
  if (anyOpen) {
    return {
      group: anyOpen,
      accountType: anyOpen.openRent > 0 ? 'RENT' : 'UTILITIES',
      fits: false,
    };
  }
  return { group: groups[0]!, accountType: 'RENT', fits: false };
}

function matchRow(
  ctx: MatchContext,
  parsed: ParsedPayment[],
  seenInBatch: Set<string>,
): PreviewRow[] {
  return parsed.map((p, index) => {
    const base = {
      index,
      raw: p.raw,
      amount: p.amount,
      currency: p.currency,
      reference: p.reference ?? null,
      externalId: p.externalId ?? null,
      senderPhone: p.senderPhone ?? null,
      paidAt: p.paidAt ?? null,
      accountType: 'RENT' as ImportAccountType,
      matched: null as PreviewMatched | null,
      duplicateOf: null as PreviewRow['duplicateOf'],
    };

    // 1) dedupe — receipt code wins as the key; reference text only decides
    //    for receipt-less rows (see buildMatchContext's set comments).
    const dupKey = p.externalId ?? p.reference;
    const byCode = p.externalId
      ? ctx.usedExternalIds.has(p.externalId) || seenInBatch.has(p.externalId)
      : false;
    const byRef =
      !p.externalId && p.reference
        ? ctx.usedReferences.has(p.reference) || seenInBatch.has(p.reference)
        : false;
    if (byCode || byRef) {
      const fromBatch = dupKey ? seenInBatch.has(dupKey) : false;
      const fromClaim = dupKey ? ctx.claimedIdentifiers.has(dupKey) : false;
      return {
        ...base,
        status: 'DUPLICATE' as const,
        confidence: 100,
        preChecked: false,
        duplicateOf: fromBatch ? 'batch' : fromClaim ? 'claim' : 'payment',
      };
    }
    if (p.externalId) seenInBatch.add(p.externalId);
    else if (p.reference) seenInBatch.add(p.reference);

    // 2) signals
    const phoneTenants =
      p.senderPhone != null ? (ctx.tenantIdsByPhone.get(p.senderPhone) ?? []) : [];
    const ref = p.reference?.toLowerCase();
    const unitHit = ref ? ctx.unitByRef.get(ref) : undefined;
    const leaseHit = ref ? ctx.leaseByRef.get(ref) : undefined;
    let accountAnchor: { tenantId: string; leaseId: string | null; unitId: string | null; propertyId: string } | null =
      null;
    if (unitHit) {
      const active = ctx.activeByUnit.get(unitHit.id);
      if (active) {
        accountAnchor = {
          tenantId: active.tenantId,
          leaseId: active.leaseId,
          unitId: unitHit.id,
          propertyId: active.propertyId,
        };
      }
    } else if (leaseHit?.primaryTenantId) {
      accountAnchor = {
        tenantId: leaseHit.primaryTenantId,
        leaseId: leaseHit.id,
        unitId: leaseHit.firstUnitId,
        propertyId: leaseHit.propertyId,
      };
    }

    if (phoneTenants.length === 0 && !accountAnchor) {
      return {
        ...base,
        status: 'UNMATCHED' as const,
        confidence: 0,
        preChecked: false,
      };
    }

    const asMatched = (
      tenantId: string,
      group: AnchorGroup | null,
    ): PreviewMatched => ({
      tenantId,
      tenantName: group?.tenantName ?? ctx.tenantsById.get(tenantId)?.displayName ?? '',
      leaseId: group?.leaseId ?? accountAnchor?.leaseId ?? null,
      unitId: group?.unitId ?? accountAnchor?.unitId ?? null,
      unitRef: group?.unitRef ?? null,
      propertyId: group?.propertyId ?? accountAnchor?.propertyId ?? '',
      openRent: money(group?.openRent ?? 0),
      openUtilities: money(group?.openUtilities ?? 0),
    });

    // 3) conflicting single-vs-single → AMBIGUOUS (account candidate wins the row)
    if (phoneTenants.length > 0 && accountAnchor && !phoneTenants.includes(accountAnchor.tenantId)) {
      const { group, accountType } = pickGroup(ctx, accountAnchor.tenantId, p.amount);
      return {
        ...base,
        status: 'AMBIGUOUS' as const,
        accountType,
        confidence: 40,
        preChecked: false,
        matched: asMatched(accountAnchor.tenantId, group),
      };
    }

    // 4) agreed / single-signal paths
    const agree = Boolean(phoneTenants.length > 0 && accountAnchor);
    const tenantId = accountAnchor?.tenantId ?? phoneTenants[0]!;
    const { group, accountType, fits } = pickGroup(ctx, tenantId, p.amount);
    const matched = asMatched(tenantId, group);

    if (agree) {
      return {
        ...base,
        status: fits ? 'MATCHED' : 'AMBIGUOUS',
        accountType,
        confidence: fits ? 95 : 70,
        preChecked: fits,
        matched,
      };
    }
    if (phoneTenants.length > 0) {
      // phone + amount corroborate → MATCHED; phone alone → glance first
      return {
        ...base,
        status: fits ? 'MATCHED' : 'AMBIGUOUS',
        accountType,
        confidence: fits ? 88 : 65,
        preChecked: fits,
        matched,
      };
    }
    // account ref + amount
    return {
      ...base,
      status: fits ? 'MATCHED' : 'AMBIGUOUS',
      accountType,
      confidence: fits ? 85 : 60,
      preChecked: fits,
      matched,
    };
  });
}

function requireRawText(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new RouteError(400, 'Paste at least one M-Pesa message');
  }
  if (raw.length > 200_000) throw new RouteError(400, 'Paste is too large (200k chars max)');
  return raw;
}

function requireSource(raw: unknown): string {
  const source = typeof raw === 'string' && raw.trim() ? raw.trim() : 'mpesa-sms';
  try {
    getPaymentSourceAdapter(source);
  } catch {
    throw new RouteError(400, `Unknown payment source '${source}'`);
  }
  return source;
}

export interface ImportSummary {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  duplicate: number;
  preChecked: number;
}

function summarize(rows: PreviewRow[]): ImportSummary {
  return {
    total: rows.length,
    matched: rows.filter((r) => r.status === 'MATCHED').length,
    ambiguous: rows.filter((r) => r.status === 'AMBIGUOUS').length,
    unmatched: rows.filter((r) => r.status === 'UNMATCHED').length,
    duplicate: rows.filter((r) => r.status === 'DUPLICATE').length,
    preChecked: rows.filter((r) => r.preChecked).length,
  };
}

/** Parse + match. Zero writes — safe to call repeatedly. */
export async function previewImport(
  actor: ScopeActor,
  raw: { source?: unknown; rawText?: unknown },
): Promise<{ source: string; rows: PreviewRow[]; summary: ImportSummary }> {
  const source = requireSource(raw.source);
  const text = requireRawText(raw.rawText);
  const adapter = getPaymentSourceAdapter(source);
  const parsed = adapter.parse(text);
  if (parsed.length === 0) throw new RouteError(400, 'No payment messages found in the paste');

  const ctx = await buildMatchContext(actor, parsed);
  const rows = matchRow(ctx, parsed, new Set());
  return { source, rows, summary: summarize(rows) };
}

export type CommitResult = {
  batchId: string;
  applied: number;
  failed: number;
  duplicates: number;
  skipped: number;
  errors: { index: number; message: string }[];
  summary: ImportSummary;
};

/**
 * Persist the batch and apply checked rows. The paste is re-parsed and
 * re-matched server-side; `decisions` only carries per-row opt-ins and
 * manual overrides (tenant/accountType).
 */
export async function commitImport(
  actor: ScopeActor,
  raw: { source?: unknown; rawText?: unknown; decisions?: unknown },
): Promise<CommitResult> {
  const source = requireSource(raw.source);
  const text = requireRawText(raw.rawText);
  if (!Array.isArray(raw.decisions)) throw new RouteError(400, 'decisions must be an array');

  const adapter = getPaymentSourceAdapter(source);
  const parsed = adapter.parse(text);
  if (parsed.length === 0) throw new RouteError(400, 'No payment messages found in the paste');

  const decisions: ImportDecision[] = raw.decisions.map((d, i) => {
    const rec = (d ?? {}) as Record<string, unknown>;
    const index = Number(rec.index);
    if (!Number.isInteger(index) || index < 0 || index >= parsed.length) {
      throw new RouteError(400, `decisions[${i}].index is out of range`);
    }
    return {
      index,
      checked: rec.checked === true,
      tenantId: typeof rec.tenantId === 'string' && rec.tenantId ? rec.tenantId : undefined,
      accountType:
        rec.accountType === 'UTILITIES' || rec.accountType === 'RENT'
          ? rec.accountType
          : undefined,
    };
  });
  const byIndex = new Map<number, ImportDecision>();
  for (const d of decisions) {
    if (byIndex.has(d.index)) throw new RouteError(400, `duplicate decision for row ${d.index}`);
    byIndex.set(d.index, d);
  }

  const ctx = await buildMatchContext(actor, parsed);
  const rows = matchRow(ctx, parsed, new Set());

  const batch = await db.paymentImportBatch.create({
    data: {
      organizationId: actor.organizationId,
      source,
      rawText: text,
      importedByUserId: actor.userId,
    },
    select: { id: true },
  });

  const errors: CommitResult['errors'] = [];
  let applied = 0;
  let failed = 0;
  let duplicates = 0;
  let skipped = 0;
  const seenInCommit = new Set<string>();

  for (const row of rows) {
    const decision = byIndex.get(row.index);
    let status: ImportRowStatus = row.status;
    let paymentId: string | null = null;

    if (decision?.checked) {
      if (row.status === 'DUPLICATE') {
        duplicates += 1;
        errors.push({ index: row.index, message: 'Already recorded — receipt code is a duplicate' });
      } else {
        const overrideTenant = decision.tenantId;
        if (overrideTenant) {
          const tenant = await db.tenant.findFirst({
            where: { id: overrideTenant, organizationId: actor.organizationId },
            select: { id: true },
          });
          if (!tenant) {
            failed += 1;
            errors.push({ index: row.index, message: 'Selected tenant not found' });
          }
        }
        if (!errors.some((e) => e.index === row.index)) {
          const tenantId = overrideTenant ?? row.matched?.tenantId;
          if (!tenantId) {
            failed += 1;
            errors.push({ index: row.index, message: 'No tenant matched — pick one' });
            status = 'UNMATCHED';
          } else {
            const picked = pickGroup(ctx, tenantId, row.amount);
            const accountType = decision.accountType ?? picked.accountType;
            if (!picked.group) {
              failed += 1;
              status = 'AMBIGUOUS';
              errors.push({
                index: row.index,
                message: 'Selected tenant has no open charges to allocate against',
              });
            } else {
              // fresh dedupe right before money moves — receipt code (or,
              // for receipt-less rows, the reference text) must be unused.
              // PaymentClaim has no externalId column: claims dedupe by
              // reference only (a tenant may have typed the receipt code there).
              const code = row.externalId;
              const ref = row.reference;
              const dupKey = code ?? ref;
              const paymentWhere = code
                ? { organizationId: actor.organizationId, OR: [{ externalId: code }, { reference: code }] }
                : ref
                  ? { organizationId: actor.organizationId, OR: [{ reference: ref }] }
                  : null;
              const claimKeys = [code, ref].filter((k): k is string => Boolean(k));
              const already =
                (dupKey ? seenInCommit.has(dupKey) : false) ||
                (paymentWhere !== null &&
                  (await db.payment.findFirst({
                    where: paymentWhere,
                    select: { id: true },
                  })) !== null) ||
                (claimKeys.length > 0 &&
                  (await db.paymentClaim.findFirst({
                    where: {
                      organizationId: actor.organizationId,
                      status: { not: 'REJECTED' },
                      reference: { in: claimKeys },
                    },
                    select: { id: true },
                  })) !== null);
              if (already) {
                status = 'DUPLICATE';
                duplicates += 1;
                errors.push({ index: row.index, message: 'Receipt code already recorded' });
              } else {
                try {
                  const result = await recordMultiMonthPayment(actor, {
                    propertyId: picked.group.propertyId,
                    unitId: picked.group.unitId,
                    tenantId,
                    leaseId: picked.group.leaseId,
                    accountType,
                    months: 36,
                    amount: row.amount ?? undefined,
                    method: 'MPESA',
                    reference: code ?? ref ?? null,
                    externalId: code,
                    source: 'IMPORT',
                    notes: `Imported from ${source} paste (batch ${batch.id})`,
                    receivedAt: row.paidAt ? new Date(row.paidAt) : new Date(),
                  });
                  status = 'APPLIED';
                  paymentId = result.paymentId;
                  applied += 1;
                  if (dupKey) seenInCommit.add(dupKey);
                } catch (err) {
                  failed += 1;
                  status = row.matched ? 'AMBIGUOUS' : 'UNMATCHED';
                  const message =
                    err instanceof RouteError
                      ? err.message
                      : 'Could not record this payment (see server logs)';
                  errors.push({ index: row.index, message });
                }
              }
            }
          }
        }
      }
    } else if (row.status !== 'DUPLICATE') {
      skipped += 1;
    } else {
      duplicates += 1;
    }

    await db.paymentImportRow.create({
      data: {
        batchId: batch.id,
        organizationId: actor.organizationId,
        rawLine: row.raw,
        amount: row.amount,
        currency: row.currency,
        reference: row.reference,
        externalId: row.externalId,
        senderPhone: row.senderPhone,
        paidAt: row.paidAt ? new Date(row.paidAt) : null,
        status,
        accountType: row.accountType,
        confidence: row.confidence,
        matchedTenantId: row.matched?.tenantId ?? null,
        matchedLeaseId: row.matched?.leaseId ?? null,
        matchedUnitId: row.matched?.unitId ?? null,
        paymentId,
      },
    });
  }

  await db.paymentImportBatch.update({
    where: { id: batch.id },
    data: { appliedAt: new Date() },
  });

  const summary = summarize(rows);
  await auditLog(actor, 'PAYMENT', 'payment.import', batch.id, {
    source,
    total: summary.total,
    applied,
    duplicates,
    failed,
    unchecked: skipped,
  });

  return {
    batchId: batch.id,
    applied,
    failed,
    duplicates,
    skipped,
    errors,
    summary,
  };
}

/** Recent import batches with per-status counts (register history). */
export async function listImports(actor: ScopeActor): Promise<{
  imports: {
    id: string;
    source: string;
    createdAt: string;
    appliedAt: string | null;
    importedBy: string | null;
    total: number;
    applied: number;
    duplicate: number;
    pending: number;
  }[];
}> {
  const batches = await db.paymentImportBatch.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      source: true,
      createdAt: true,
      appliedAt: true,
      importedByUserId: true,
      rows: { select: { status: true } },
    },
  });
  const userIds = [
    ...new Set(batches.map((b) => b.importedByUserId).filter((u): u is string => Boolean(u))),
  ];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.displayName]));

  return {
    imports: batches.map((b) => ({
      id: b.id,
      source: b.source,
      createdAt: b.createdAt.toISOString(),
      appliedAt: b.appliedAt ? b.appliedAt.toISOString() : null,
      importedBy: b.importedByUserId ? (names.get(b.importedByUserId) ?? null) : null,
      total: b.rows.length,
      applied: b.rows.filter((r) => r.status === 'APPLIED').length,
      duplicate: b.rows.filter((r) => r.status === 'DUPLICATE').length,
      pending: b.rows.filter((r) => r.status !== 'APPLIED' && r.status !== 'DUPLICATE').length,
    })),
  };
}
