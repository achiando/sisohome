/**
 * Ledger-account domain — the rent / utilities account pair every property
 * owns (Slice 3, user decision 2026-10-23: real account rows, property pair
 * by default with optional unit override).
 *
 * Rules:
 * - `ensurePropertyAccounts` is idempotent: creates the missing half of the
 *   pair on first finances touch; never deletes or renames existing rows.
 * - Unit override: `resolveAccount` prefers an ACTIVE unit-scoped account of
 *   that type, else the property's.
 * - Scope flows through the parent property (`propertyScopeWhere`); a unit-
 *   scoped account resolves scope via its unit's property.
 */

import type { LedgerAccountType } from '@workspace/database';
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import { propertyScopeWhere, requirePropertyInScope, type ScopeActor } from './property-scope';

export const LEDGER_ACCOUNT_TYPES: LedgerAccountType[] = ['RENT', 'UTILITIES'];

const DEFAULT_NAMES: Record<LedgerAccountType, string> = {
  RENT: 'Rent account',
  UTILITIES: 'Utilities account',
};

export interface LedgerAccountRow {
  id: string;
  accountType: string;
  name: string;
  reference: string | null;
  currency: string;
  isActive: boolean;
  propertyId: string | null;
  unitId: string | null;
}

function shape(row: {
  id: string;
  accountType: LedgerAccountType;
  name: string;
  reference: string | null;
  currency: string;
  isActive: boolean;
  propertyId: string | null;
  unitId: string | null;
}): LedgerAccountRow {
  return {
    id: row.id,
    accountType: row.accountType as string,
    name: row.name,
    reference: row.reference,
    currency: row.currency,
    isActive: row.isActive,
    propertyId: row.propertyId,
    unitId: row.unitId,
  };
}

/**
 * Idempotently ensure the property's RENT + UTILITIES pair exists. Returns
 * both (existing or created), ordered RENT first.
 */
export async function ensurePropertyAccounts(
  actor: ScopeActor,
  propertyId: string,
  opts: { currency?: string } = {},
): Promise<LedgerAccountRow[]> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(actor) },
    select: { id: true, currency: true },
  });
  if (!property) throw new RouteError(404, 'Property not found');
  const currency = (opts.currency ?? property.currency ?? 'KES').toUpperCase();

  const existing = await db.ledgerAccount.findMany({
    where: { propertyId, unitId: null, organizationId: actor.organizationId },
    orderBy: { accountType: 'asc' },
  });
  const missing = LEDGER_ACCOUNT_TYPES.filter((t) => !existing.some((a) => a.accountType === t));
  if (missing.length > 0) {
    await db.ledgerAccount.createMany({
      data: missing.map((t) => ({
        organizationId: actor.organizationId,
        propertyId,
        accountType: t,
        name: DEFAULT_NAMES[t],
        currency,
      })),
      skipDuplicates: true,
    });
  }
  const rows = await db.ledgerAccount.findMany({
    where: { propertyId, unitId: null, organizationId: actor.organizationId },
    orderBy: { accountType: 'asc' },
  });
  return rows.map(shape);
}

/** Property- or unit-scoped accounts (unit override rows included when given). */
export async function listLedgerAccounts(
  actor: ScopeActor,
  filter: { propertyId: string },
): Promise<LedgerAccountRow[]> {
  await requirePropertyInScope(actor, filter.propertyId);
  const rows = await db.ledgerAccount.findMany({
    where: { propertyId: filter.propertyId, organizationId: actor.organizationId, isActive: true },
    orderBy: [{ unitId: 'asc' }, { accountType: 'asc' }],
  });
  return rows.map(shape);
}

/**
 * Resolve the account a payment should land in: unit override first, then
 * the property pair (auto-ensuring it exists).
 */
export async function resolveAccount(
  actor: ScopeActor,
  propertyId: string,
  accountType: LedgerAccountType,
  opts: { unitId?: string | null } = {},
): Promise<LedgerAccountRow> {
  if (opts.unitId) {
    const unitAccount = await db.ledgerAccount.findFirst({
      where: {
        unitId: opts.unitId,
        accountType,
        organizationId: actor.organizationId,
        isActive: true,
        property: propertyScopeWhere(actor),
      },
    });
    if (unitAccount) return shape(unitAccount);
  }
  const pair = await ensurePropertyAccounts(actor, propertyId);
  const found = pair.find((a) => a.accountType === accountType);
  if (!found) throw new RouteError(409, `Property has no ${accountType} account`);
  return found;
}
