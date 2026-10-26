/**
 * Scheduled jobs — run from `/api/cron/run`, which GitHub Actions calls on
 * a schedule (see .github/workflows/scheduled-jobs.yml). No session exists
 * here: each job walks organizations, acts as each org's first active
 * member (the system actor) and delivers results as in-app notifications —
 * never email.
 *
 * Every job accepts optional `{ organizationId, propertyId, month }`
 * filters so ops can re-run a single scope and smokes don't touch other
 * orgs' dev data.
 */
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';

import { generateMonthlyCharges } from './monthly';
import { notifyOrgUsersOnce } from './notification';
import { propertyScopeWhere, type ScopeActor } from './property-scope';

export type JobFilter = {
  organizationId?: string;
  propertyId?: string;
  month?: string;
};

export type JobSummary = {
  job: string;
  orgs: number;
  properties: number;
  chargesCreated: number;
  chargesSkipped: number;
  notifications: number;
  errors: string[];
};

export const SCHEDULED_JOBS = ['generate-charges', 'lease-expiry'] as const;
export type ScheduledJobName = (typeof SCHEDULED_JOBS)[number];

/** Lease-expiry notification windows, in days before endsAt. */
const EXPIRY_WINDOWS = [60, 30, 7] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function targetOrgIds(filter: JobFilter): Promise<string[]> {
  if (filter.organizationId) return [filter.organizationId];
  const orgs = await db.organization.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  return orgs.map((o) => o.id);
}

/** The org's first active member — every audit row points at a real user. */
async function systemActor(orgId: string): Promise<ScopeActor | null> {
  const member = await db.organizationMember.findFirst({
    where: { organizationId: orgId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  return member ? { userId: member.userId, organizationId: orgId } : null;
}

function emptySummary(job: string): JobSummary {
  return {
    job,
    orgs: 0,
    properties: 0,
    chargesCreated: 0,
    chargesSkipped: 0,
    notifications: 0,
    errors: [],
  };
}

/**
 * Monthly charge generation across scoped properties (idempotent per
 * property+month). Writes one summary notification per org that had
 * anything generated, deduped on the run month.
 */
export async function runGenerateCharges(filter: JobFilter = {}): Promise<JobSummary> {
  const summary = emptySummary('generate-charges');
  const month = filter.month ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new RouteError(400, 'month must be YYYY-MM');
  }
  const orgIds = await targetOrgIds(filter);
  summary.orgs = orgIds.length;

  for (const orgId of orgIds) {
    const actor = await systemActor(orgId);
    if (!actor) {
      summary.errors.push(`org ${orgId}: no active member to act as`);
      continue;
    }
    const properties = await db.property.findMany({
      where: {
        AND: [propertyScopeWhere(actor), ...(filter.propertyId ? [{ id: filter.propertyId }] : [])],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    summary.properties += properties.length;

    let orgCreated = 0;
    for (const property of properties) {
      try {
        const result = await generateMonthlyCharges(actor, { propertyId: property.id, month });
        const created = result.rentCreated + result.utilitiesCreated;
        orgCreated += created;
        summary.chargesCreated += created;
        summary.chargesSkipped += result.rentSkipped + result.utilitiesSkipped;
      } catch (err) {
        summary.errors.push(`${property.name}: ${errText(err)}`);
      }
    }

    if (orgCreated > 0) {
      try {
        summary.notifications += await notifyOrgUsersOnce(
          orgId,
          'charge.list',
          `charges:${month}`,
          {
            type: 'cron.generate_charges',
            title: `Charges generated for ${month}`,
            body: `${orgCreated} new charge${orgCreated === 1 ? '' : 's'} posted. Review them in Finances.`,
            link: '/finances',
            metadata: { month, created: orgCreated },
          },
        );
      } catch (err) {
        summary.errors.push(`org ${orgId}: summary notification failed: ${errText(err)}`);
      }
    }
  }
  return summary;
}

/**
 * Lease-expiry alerts — leases ending within 60 days (ACTIVE/ENDING)
 * notify the org's lease.list holders once per window (60/30/7 days).
 */
export async function runLeaseExpiryAlerts(filter: JobFilter = {}): Promise<JobSummary> {
  const summary = emptySummary('lease-expiry');
  const orgIds = await targetOrgIds(filter);
  summary.orgs = orgIds.length;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(startOfToday.getTime() + EXPIRY_WINDOWS[0] * DAY_MS);

  for (const orgId of orgIds) {
    const actor = await systemActor(orgId);
    if (!actor) {
      summary.errors.push(`org ${orgId}: no active member to act as`);
      continue;
    }

    const leases = await db.lease.findMany({
      where: {
        AND: [
          { property: propertyScopeWhere(actor) },
          ...(filter.propertyId ? [{ propertyId: filter.propertyId }] : []),
          { status: { in: ['ACTIVE', 'ENDING'] } },
          { endsAt: { not: null, gte: startOfToday, lte: horizon } },
        ],
      },
      select: {
        id: true,
        endsAt: true,
        property: { select: { name: true } },
        units: {
          select: { unit: { select: { unitRef: true, label: true } } },
          take: 2,
        },
      },
      orderBy: { endsAt: 'asc' },
    });

    for (const lease of leases) {
      if (!lease.endsAt) continue;
      const endStart = new Date(
        lease.endsAt.getFullYear(),
        lease.endsAt.getMonth(),
        lease.endsAt.getDate(),
      );
      const daysLeft = Math.round((endStart.getTime() - startOfToday.getTime()) / DAY_MS);
      const window = EXPIRY_WINDOWS.find((w) => daysLeft <= w);
      if (!window) continue;

      const unitLabels = lease.units
        .map((lu) => lu.unit.label ?? lu.unit.unitRef)
        .join(', ');
      const when =
        daysLeft <= 0
          ? 'ends today'
          : `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

      try {
        summary.notifications += await notifyOrgUsersOnce(
          orgId,
          'lease.list',
          `lease:${lease.id}:${window}`,
          {
            type: 'lease_expiring',
            title: `Lease ${when} — ${lease.property.name}`,
            body: unitLabels ? `Unit ${unitLabels} · ends ${lease.endsAt.toISOString().slice(0, 10)}` : `Ends ${lease.endsAt.toISOString().slice(0, 10)}`,
            link: `/leasing/leases/${lease.id}`,
            metadata: { leaseId: lease.id, window, endsAt: lease.endsAt.toISOString() },
          },
        );
      } catch (err) {
        summary.errors.push(`lease ${lease.id}: ${errText(err)}`);
      }
    }
  }
  return summary;
}

/**
 * Entry point for the cron route: `job` is 'all' (default) or one of
 * SCHEDULED_JOBS. Filters pass through.
 */
export async function runScheduledJob(
  job: string,
  filter: JobFilter = {},
): Promise<{ job: string; ranAt: string; results: JobSummary[] }> {
  const name = (job || 'all').trim();
  if (name !== 'all' && !SCHEDULED_JOBS.includes(name as ScheduledJobName)) {
    throw new RouteError(400, `Unknown job "${name}" — use "all" or one of: ${SCHEDULED_JOBS.join(', ')}`);
  }

  const results: JobSummary[] = [];
  if (name === 'all' || name === 'generate-charges') {
    results.push(await runGenerateCharges(filter));
  }
  if (name === 'all' || name === 'lease-expiry') {
    results.push(await runLeaseExpiryAlerts(filter));
  }
  return { job: name, ranAt: new Date().toISOString(), results };
}
