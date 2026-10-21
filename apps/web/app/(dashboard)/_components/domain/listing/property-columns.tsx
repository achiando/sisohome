/**
 * Property register columns + mobile card mapper (siso-design
 * portfolio-property.webp). Type column uses the business category badge;
 * Occupancy renders the lease-derived rate ring; Balance is the DERIVED
 * ledger amount (shown only with charge.list + server-provided rows);
 * Owner/Agreement columns render for non-LANDLORD workspaces (kind gate in
 * the page). Row actions: quick View + an overflow DropdownMenu gated by
 * permission booleans — server routes re-check every action anyway.
 */

import type { CardMapper, ColumnDef } from '@workspace/ui/components/shared'
import { Badge, type BadgeProps } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Archive,
  ArchiveRestore,
  Building2,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'
import { PropertyStatusBadge } from '@/app/(dashboard)/portfolio/_components/property-status'
import { PROPERTY_CATEGORIES } from '@/lib/domain/property-constants'
import { MoneyCell, OccupancyRing, PropertyCell } from './cells'
import type { PropertyListRow } from './types'

export type PropertyRowAction =
  | 'view'
  | 'edit'
  | 'addUnit'
  | 'addTenant'
  | 'uploadMedia'
  | 'archive'
  | 'unarchive'
  | 'delete'

export interface PropertyColumnOptions {
  /** charge.list — the Balance column renders only when true. */
  showMoney: boolean
  /** Owner column — hidden for LANDLORD workspaces. */
  showOwner: boolean
  /** Agreement column — hidden for LANDLORD workspaces. */
  showAgreement: boolean
  /** UX gating per action (permission booleans from the page). */
  can: Partial<Record<PropertyRowAction, boolean>>
  onAction: (action: PropertyRowAction, row: PropertyListRow) => void
}

const AGREEMENT_VARIANT: Record<string, BadgeProps['variant']> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DRAFT: 'neutral',
  ENDED: 'neutral',
  TERMINATED: 'error',
}

function OwnerCell({ owners }: { owners: NonNullable<PropertyListRow['owners']> }) {
  if (owners.length === 0) return <span className="text-muted-foreground">—</span>
  const first = owners[0]
  return (
    <div className="min-w-0">
      <p className="truncate text-sm">{owners.map((o) => o.name).join(', ')}</p>
      <p className="truncate text-xs text-muted-foreground">
        {owners.length > 1
          ? `${owners.length} owners`
          : first && first.sharePercent != null
            ? `${first.sharePercent}% share`
            : '—'}
      </p>
    </div>
  )
}

function AgreementCell({ agreement }: { agreement: NonNullable<PropertyListRow['agreement']> }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={AGREEMENT_VARIANT[agreement.status] ?? 'neutral'} size="sm">
        {agreement.status}
      </Badge>
      {agreement.startsAt ? (
        <span className="text-xs text-muted-foreground">{formatRelativeDay(agreement.startsAt)}</span>
      ) : null}
    </div>
  )
}

export function buildPropertyColumns({
  showMoney,
  showOwner,
  showAgreement,
  can,
  onAction,
}: PropertyColumnOptions): {
  columns: ColumnDef<PropertyListRow>[]
  cardMapper: CardMapper<PropertyListRow>
} {
  const overflowActions: Array<{
    action: PropertyRowAction
    label: string
    icon: typeof Pencil
    destructive?: boolean
  }> = [
    ...(can.edit ? [{ action: 'edit' as const, label: 'Edit', icon: Pencil }] : []),
    ...(can.addUnit ? [{ action: 'addUnit' as const, label: 'Add unit', icon: Building2 }] : []),
    ...(can.addTenant ? [{ action: 'addTenant' as const, label: 'Add tenant', icon: UserPlus }] : []),
    ...(can.uploadMedia
      ? [{ action: 'uploadMedia' as const, label: 'Upload media', icon: ImagePlus }]
      : []),
    ...(can.archive
      ? [{ action: 'archive' as const, label: 'Archive', icon: Archive }]
      : []),
    ...(can.unarchive
      ? [{ action: 'unarchive' as const, label: 'Unarchive', icon: ArchiveRestore }]
      : []),
    ...(can.delete
      ? [{ action: 'delete' as const, label: 'Delete draft', icon: Trash2, destructive: true }]
      : []),
  ]

  const columns: ColumnDef<PropertyListRow>[] = [
    {
      header: 'Property',
      cell: (p) => <PropertyCell row={p} />,
    },
    {
      header: 'Type',
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral" size="sm">
            {PROPERTY_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {p.propertyType.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (p) => <PropertyStatusBadge status={p.status} />,
    },
    {
      header: 'Units',
      cell: (p) => (
        <span className="tabular-nums">
          {p._count.units}
          <span className="text-muted-foreground"> / {p._count.buildings} bldg</span>
        </span>
      ),
    },
    {
      header: 'Occupancy Rate',
      className: 'w-40',
      cell: (p) => (
        <OccupancyRing rate={p.occupancy.rate} occupied={p.occupancy.occupied} total={p.occupancy.total} />
      ),
    },
    ...(showOwner
      ? ([
          {
            header: 'Owner',
            cell: (p) => <OwnerCell owners={p.owners ?? []} />,
          },
        ] as ColumnDef<PropertyListRow>[])
      : []),
    ...(showAgreement
      ? ([
          {
            header: 'Agreement',
            cell: (p) =>
              p.agreement ? (
                <AgreementCell agreement={p.agreement} />
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ] as ColumnDef<PropertyListRow>[])
      : []),
    ...(showMoney
      ? ([
          {
            header: 'Balance',
            cell: (p) =>
              p.balance ? (
                <MoneyCell value={p.balance.amount} currency={p.balance.currency} />
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ] as ColumnDef<PropertyListRow>[])
      : []),
    {
      header: '',
      className: 'w-32',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('view', p)}
            aria-label={`View ${p.name}`}
          >
            View
          </Button>
          {overflowActions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg"
                  aria-label={`Actions for ${p.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 min-w-0">
                {overflowActions.map((item) => (
                  <DropdownMenuItem
                    key={item.action}
                    variant={item.destructive ? 'destructive' : 'default'}
                    onSelect={() => onAction(item.action, p)}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ),
    },
  ]

  const cardMapper: CardMapper<PropertyListRow> = {
    id: (p) => p.id,
    title: (p) => p.name,
    subtitle: (p) => [p.code, p.locality ?? p.addressLine1].filter(Boolean).join(' · ') || undefined,
    fallbackIcon: () => <Building2 className="size-4" />,
    statusBadge: (p) => <PropertyStatusBadge status={p.status} />,
    detailFields: (p) => [
      { label: 'Units', value: `${p._count.units} (${p.occupancy.occupied} occ)` },
      { label: 'Occupancy', value: `${p.occupancy.rate}%` },
      ...(showOwner && p.owners && p.owners.length > 0
        ? [{ label: 'Owner', value: p.owners.map((o) => o.name).join(', ') }]
        : []),
      ...(showMoney && p.balance
        ? [
            {
              label: 'Balance',
              value: `${p.balance.currency} ${Number(p.balance.amount).toLocaleString()}`,
            },
          ]
        : []),
      { label: 'Updated', value: formatRelativeDay(p.updatedAt) },
    ],
    actions: (p) => [
      { label: 'View', variant: 'outline' as const, onClick: () => onAction('view', p) },
      ...(can.edit
        ? [{ label: 'Edit', variant: 'ghost' as const, onClick: () => onAction('edit', p) }]
        : []),
    ],
  }

  return { columns, cardMapper }
}
