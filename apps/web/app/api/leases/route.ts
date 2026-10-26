import { authorizationService } from '@/lib/auth';
import { apiRoute, ok, RouteError } from '@/lib/api-route';
import * as lease from '@/lib/domain/lease';
import * as charges from '@/lib/domain/charge';

/**
 * GET /api/leases — lease register (scope + filters). Party contact PII is
 * stripped unless the caller also holds `tenant.read` (plan-slice-2 §2.3).
 * `showBalance=1` adds a derived `balance {open, overdue, currency}` per row
 * — gated on `charge.list` inside the route (Slice 8).
 */
export const GET = apiRoute({
  permissions: 'lease.list',
  async handler({ actor, ctx, query }) {
    const granted = ctx.organizationId
      ? await authorizationService.getUserPermissions(ctx.userId, ctx.organizationId)
      : [];
    const includeTenantPii = granted.includes('tenant.read' as never);
    const rows = await lease.listLeases(actor, {
      status: query.get('status') ?? undefined,
      propertyId: query.get('propertyId') ?? undefined,
      unitId: query.get('unitId') ?? undefined,
      expiringInDays: query.get('expiringInDays') ?? undefined,
    });
    const wantsBalance = query.get('showBalance') === '1' || query.get('showBalance') === 'true';
    const balances =
      wantsBalance && granted.includes('charge.list' as never)
        ? await charges.leaseBalances(actor, rows.map((l) => l.id))
        : null;
    const leases = rows.map((l) => ({
      ...l,
      ...(balances
        ? { balance: balances.get(l.id) ?? { open: '0', overdue: '0', currency: 'KES' } }
        : {}),
      parties: includeTenantPii
        ? l.parties
        : l.parties.map((p) => ({
            ...p,
            tenant: { id: p.tenant.id, displayName: p.tenant.displayName, status: p.tenant.status, portalStatus: p.tenant.portalStatus },
          })),
    }));
    return { leases };
  },
});

/** POST /api/leases — draft or submit a lease (overlap-checked). */
export const POST = apiRoute({
  permissions: 'lease.create',
  async handler({ actor, body }) {
    const input = await body();
    if (!input || typeof input !== 'object') throw new RouteError(400, 'Invalid payload');
    const row = await lease.createLease(actor, input);
    return ok({ lease: row }, { status: 201 });
  },
});
