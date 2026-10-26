/**
 * Billing notice delivery — manager-triggered push of current billing
 * amounts to a unit's occupant (email + durable portal record).
 *
 * Zero schema change: the email goes through `@workspace/email` (dev outbox)
 * and the durable record reuses `PropertyDocument(entityType: TENANT,
 * kind: NOTICE)` with a relative `generated/…` storageKey — the same
 * precedent as e-sign evidence rows (`agreement-sign.ts`), so it surfaces in
 * the tenant portal Documents tab automatically.
 *
 * Batch shape: `POST /api/units/billing-notices { unitIds: [...] }` serves
 * both the single-unit detail action and the register's send-all-matching
 * bulk button. Units out of scope vanish as `not-found`; when nothing
 * resolves the caller gets a 404.
 */
import { sendEmail } from '@workspace/email';

import { RouteError } from '@/lib/api-route';
import { appUrl } from '@/lib/base-url';
import { billingNoticeEmail, type BillingNoticeUnit } from '@/lib/email/billing-notice';
import { db } from '@/lib/auth';
import { auditLog } from './audit';
import { createDocument } from './documents';
import { unitChargeSummary } from './monthly';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { occupantMap } from './unit';

export type BillingNoticeSkipReason = 'not-found' | 'vacant' | 'no-email';

export interface BillingNoticeSkip {
  unitId: string;
  reason: BillingNoticeSkipReason;
}

export interface BillingNoticeResult {
  /** Notices emailed (one per tenant, units aggregated). */
  emailed: number;
  /** NOTICE documents filed (one per tenant per send). */
  filed: number;
  /** Units in scope that had an occupant with an email address. */
  units: number;
  skipped: BillingNoticeSkip[];
}

/** Per-request cap; the register chunks its filtered rows to this size. */
export const MAX_NOTICE_UNITS = 50;

/** Unit ids are UUIDs — non-UUID input never reaches Postgres (P2023). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ScopedUnit {
  id: string;
  unitRef: string;
  label: string | null;
  propertyId: string;
  property: { name: string };
}

export async function sendBillingNotice(actor: ScopeActor, raw: unknown): Promise<BillingNoticeResult> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const ids = [
    ...new Set(
      Array.isArray(body.unitIds)
        ? body.unitIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : [],
    ),
  ];
  if (ids.length === 0) throw new RouteError(400, 'unitIds is required');
  if (ids.length > MAX_NOTICE_UNITS) {
    throw new RouteError(400, `Send at most ${MAX_NOTICE_UNITS} units per request`);
  }

  // Malformed ids are "not found" by definition — filter before the query
  // so Postgres never sees a non-UUID literal in an `in` list.
  const malformed = ids.filter((id) => !UUID_RE.test(id));
  const queryIds = ids.filter((id) => UUID_RE.test(id));
  const units = (await db.unit.findMany({
    where: { id: { in: queryIds }, property: propertyScopeWhere(actor) },
    select: {
      id: true,
      unitRef: true,
      label: true,
      propertyId: true,
      property: { select: { name: true } },
    },
    orderBy: [{ propertyId: 'asc' }, { unitRef: 'asc' }],
  })) as ScopedUnit[];

  const skipped: BillingNoticeSkip[] = [
    ...malformed.map((unitId) => ({ unitId, reason: 'not-found' as const })),
    ...ids
      .filter((id) => !malformed.includes(id) && !units.some((u) => u.id === id))
      .map((unitId) => ({ unitId, reason: 'not-found' as const })),
  ];
  if (units.length === 0) throw new RouteError(404, 'Units not found');

  const unitIds = units.map((u) => u.id);
  const occupants = await occupantMap(unitIds, true);

  // Vacant units drop out here.
  const occupied = units.filter((u) => {
    if (!occupants.has(u.id)) {
      skipped.push({ unitId: u.id, reason: 'vacant' });
      return false;
    }
    return true;
  });

  // Billing data — same balance math as listCharges / unitChargeSummary:
  // amount − allocations − APPROVED adjustments, overdue = past due + open.
  const summary = await unitChargeSummary(actor, unitIds);
  const [charges, schedules] = await Promise.all([
    db.charge.findMany({
      where: {
        unitId: { in: unitIds },
        organizationId: actor.organizationId,
        property: propertyScopeWhere(actor),
        postedAt: { not: null },
      },
      select: {
        unitId: true,
        title: true,
        amount: true,
        dueDate: true,
        allocations: { select: { amount: true } },
        adjustments: { select: { amount: true, status: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
    db.chargeSchedule.findMany({
      where: { unitId: { in: unitIds }, organizationId: actor.organizationId, isActive: true },
      select: { unitId: true, name: true, amount: true, currency: true, frequency: true },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openChargesByUnit = new Map<string, BillingNoticeUnit['charges']>();
  for (const c of charges) {
    if (!c.unitId) continue;
    const allocated = c.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const adjusted = c.adjustments
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + Number(a.amount), 0);
    const balance = Number(c.amount) - allocated - adjusted;
    if (balance <= 0.009) continue;
    const due = new Date(c.dueDate);
    due.setHours(0, 0, 0, 0);
    openChargesByUnit.set(c.unitId, [
      ...(openChargesByUnit.get(c.unitId) ?? []),
      {
        title: c.title ?? 'Charge',
        dueDate: c.dueDate.toISOString().slice(0, 10),
        balance: balance.toFixed(2),
        overdue: due < today,
      },
    ]);
  }
  const billsByUnit = new Map<string, BillingNoticeUnit['bills']>();
  for (const s of schedules) {
    if (!s.unitId) continue;
    billsByUnit.set(s.unitId, [
      ...(billsByUnit.get(s.unitId) ?? []),
      { name: s.name, amount: Number(s.amount).toFixed(2), frequency: s.frequency },
    ]);
  }

  // One notice per tenant — a tenant across several selected units gets a
  // single aggregated email + one portal document.
  const noticeByTenant = new Map<string, { email: string; displayName: string; units: BillingNoticeUnit[] }>();
  for (const u of occupied) {
    const occ = occupants.get(u.id)!;
    const email = occ.email?.trim();
    if (!email) {
      skipped.push({ unitId: u.id, reason: 'no-email' });
      continue;
    }
    const sums = summary.get(u.id);
    const existing = noticeByTenant.get(occ.tenantId);
    const noticeUnit: BillingNoticeUnit = {
      unitRef: u.unitRef,
      propertyName: u.property.name,
      currency: sums?.currency ?? 'KES',
      open: sums?.pending ?? '0',
      overdue: sums?.overdue ?? '0',
      overdueDays: sums?.overdueDays ?? 0,
      charges: openChargesByUnit.get(u.id) ?? [],
      bills: billsByUnit.get(u.id) ?? [],
    };
    if (existing) existing.units.push(noticeUnit);
    else {
      noticeByTenant.set(occ.tenantId, {
        email,
        displayName: occ.displayName,
        units: [noticeUnit],
      });
    }
  }

  if (noticeByTenant.size === 0) {
    return { emailed: 0, filed: 0, units: 0, skipped };
  }

  const tenants = await db.tenant.findMany({
    where: { id: { in: [...noticeByTenant.keys()] }, organizationId: actor.organizationId },
    select: { id: true, displayName: true, organization: { select: { name: true } } },
  });
  const orgNameById = new Map(tenants.map((t) => [t.id, t.organization.name]));

  const issuedAt = today.toISOString().slice(0, 10);
  const statementUrl = `${appUrl()}/portal/statement`;
  let emailed = 0;
  let filed = 0;

  for (const [tenantId, notice] of noticeByTenant) {
    const firstCurrency = notice.units[0]?.currency;
    const oneCurrency = firstCurrency != null && notice.units.every((u) => u.currency === firstCurrency);
    const totals = oneCurrency
      ? {
          currency: firstCurrency,
          open: notice.units.reduce((s, u) => s + Number(u.open), 0).toFixed(2),
          overdue: notice.units.reduce((s, u) => s + Number(u.overdue), 0).toFixed(2),
        }
      : null;

    // Mail is convenience — a dead mailer must not roll back the filed
    // notice (same rule as the portal invite).
    try {
      await sendEmail(
        billingNoticeEmail({
          to: notice.email,
          tenantName: notice.displayName,
          organizationName: orgNameById.get(tenantId),
          statementUrl,
          issuedAt,
          units: notice.units,
          totals,
        }),
      );
      emailed += 1;
    } catch (err) {
      console.error('Billing notice email failed:', err);
    }

    const unitRefs = notice.units.map((u) => u.unitRef).join(', ');
    try {
      await createDocument(actor, {
        entityType: 'TENANT',
        entityId: tenantId,
        kind: 'NOTICE',
        storageKey: `generated/billing/${tenantId}/${Date.now()}`,
        fileName: `billing-notice-${issuedAt}.html`,
        mimeType: 'text/html',
        caption: [
          `Billing notice ${issuedAt}`,
          totals ? `${totals.currency} ${totals.open} open` : null,
          Number(totals?.overdue ?? 0) > 0.009 ? `${totals!.currency} ${totals!.overdue} overdue` : null,
          `unit(s) ${unitRefs}`,
        ]
          .filter(Boolean)
          .join(' · '),
      });
      filed += 1;
    } catch (err) {
      console.error('Billing notice document failed:', err);
    }

    await auditLog(actor, 'tenant', 'tenant.billing-notice', tenantId, {
      displayName: notice.displayName,
      email: notice.email,
      units: unitRefs,
      open: totals?.open ?? null,
      overdue: totals?.overdue ?? null,
      currency: totals?.currency ?? null,
      emailed,
    });
  }

  return { emailed, filed, units: [...noticeByTenant.values()].reduce((s, n) => s + n.units.length, 0), skipped };
}
