/* ── thin reports summary (roadmap Phase 5) ───────────────────────────────────────
 * 5 aggregate sections: occupancy, dues aging, month payments, open tickets,
 * live listings. Every field is server‑side aggregate only — no tenant names,
 * no PII, MM‑scoped totals only. Cross‑checks wired to direct endpoints in
 * smoke-reports-summary.ts.
 *
 * All functions are pure reads — no schema changes, no new permission keys.
 *--------------------------------------------------------------------------*/

import { db } from '@/lib/auth';
import { propertyScopeWhere, type ScopeActor } from './property-scope';
import { tenantDues, type AgeBucket } from './dues';
import { listPayments } from './payment';
import { listTickets } from './maintenance';
import { listListings } from './sales';

/** ── reports summary type ──────────────────────────────────────────────────── */
export type ReportsSummary = {
  generatedAt: string;
  /** { occupied, vacant, total, rate: number(0‑100%) */
  occupancy: { occupied: number; vacant: number; total: number; rate: number };
  /** dues aggregates + per‑bucket breakdown; tenantName never leaks */
  dues: {
    outstanding: string; overdue: string; dueThisMonth: string;
    overdueCount: number; tenantCount: number; currency: string;
    /** Always 5 buckets: CURRENT|0‑30|31‑60|61‑90|90+ */
    buckets: { bucket: AgeBucket; tenants: number; open: string }[];
  };
  /** Payments received this UTC month; always includes currency breakdown. */
  monthPayments: { month: string; count: number; byCurrency: { currency: string; count: number; total: string }[] };
  /** Open tickets (status ∈ {OPEN, IN_PROGRESS, ON_HOLD}) */
  openTickets: { count: number; byStatus: { status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD'; count: number }[] };
  /** Listings with status PUBLISHED */
  liveListings: { count: number };
};

/** ── core getter ─────────────────────────────────────────────────────────────── */
export async function getReportsSummary(actor: ScopeActor): Promise<ReportsSummary> {
  const generatedAt = new Date().toISOString();

  /*********************************************
   * 1. Occupancy (units in scope → use Unit.status cache)
   *********************************************/
  const unitRows = await db.unit.findMany({
    where: { property: propertyScopeWhere(actor) },
    select: { id: true, status: true },
    orderBy: [{ property: { name: 'asc' } }, { unitRef: 'asc' }],
  });
  const total = unitRows.length;
  const occupiedCount = unitRows.filter((u) => u.status === 'OCCUPIED').length;
  const vacant = total - occupiedCount;
  const rate = total === 0 ? 0 : Math.round((occupiedCount / total) * 100 * 10) / 10; // 1‑decimal %

  /*********************************************
   * 2. Dues aging (via tenantDues → reduce to totals + buckets)
   *********************************************/
  const duesResult = await tenantDues(actor);
  const duesTotals = duesResult.totals;
  // Build 5 buckets deterministically CURRENT|0‑30|31‑60|61‑90|90+
  const bucketLabels: AgeBucket[] = ['CURRENT', '0-30', '31-60', '61-90', '90+'];
  const bucketMap = new Map<AgeBucket, { tenants: number; open: number }>();
  for (const b of bucketLabels) bucketMap.set(b, { tenants: 0, open: 0 });

  for (const row of duesResult.rows) {
    const bucket = row.bucket;
    const existing = bucketMap.get(bucket);
    if (existing) {
      existing.tenants += 1;
      existing.open += Number(row.open);
    }
  }
  const buckets = bucketLabels.map((b) => {
    const { tenants, open } = bucketMap.get(b)!;
    return { bucket: b, tenants, open: open.toFixed(2) };
  });

  /*********************************************
   * 3. Month payments (via listPayments with from/to month boundaries)
   *********************************************/
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const from = monthStart.toISOString().split('T')[0]; // 'YYYY-MM-DD' for listPayments date()
  const to = nextMonthStart.toISOString().split('T')[0];

  const paymentsResult = await listPayments(actor, { from, to });
  const monthLabel = `${new Date().toLocaleString('default', { month: 'short' })} ${now.getUTCFullYear()}`;
  const byCurrencyMap = new Map<string, { count: number; total: number }>();
  const allCurrencies = new Set<string>();

  for (const p of paymentsResult) {
    const currency = p.currency || 'KES';
    allCurrencies.add(currency);
    const existing = byCurrencyMap.get(currency);
    if (existing) {
      existing.count += 1;
      existing.total += Number(p.amount ?? 0);
    } else {
      byCurrencyMap.set(currency, { count: 1, total: Number(p.amount ?? 0) });
    }
  }
  const byCurrency = Array.from(allCurrencies).map((c) => {
    const { count, total } = byCurrencyMap.get(c) ?? { count: 0, total: 0 };
    return { currency: c, count, total: total.toFixed(2) };
  });

  /*********************************************
   * 4. Open tickets (status ∈ {OPEN, IN_PROGRESS, ON_HOLD})
   *********************************************/
  const allTickets = await listTickets(actor);
  const openStatuses = ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] as const;
  const openTicketsCount = allTickets.filter((t) => openStatuses.includes(t.status as any)).length;
  const byStatus = openStatuses.map((s) => {
    const cnt = allTickets.filter((t) => t.status === s).length;
    return { status: s, count: cnt };
  });

  /*********************************************
   * 5. Live listings (status = PUBLISHED)
   *********************************************/
  const publishedCount = (await listListings(actor, { status: 'PUBLISHED' })).length;

  /*********************************************
   * Return the thin aggregate
   *********************************************/
  return {
    generatedAt,
    occupancy: { occupied: occupiedCount, vacant, total, rate },
    dues: {
      outstanding: duesTotals.outstanding,
      overdue: duesTotals.overdue,
      dueThisMonth: duesTotals.dueThisMonth,
      overdueCount: duesTotals.overdueCount,
      tenantCount: duesTotals.tenantCount,
      currency: duesTotals.currency,
      buckets,
    },
    monthPayments: { month: monthLabel, count: paymentsResult.length, byCurrency },
    openTickets: { count: openTicketsCount, byStatus },
    liveListings: { count: publishedCount },
  };
}