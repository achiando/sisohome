/**
 * Unit register columns + mobile card mapper (siso-design portfolio.webp).
 * Property column only on the global /units register; Tenant respects the
 * tenant.read UI gate; Market Rent prefers the live lease unit rent and falls
 * back to the unit's template default. "Add tenant" appears on vacant rows and
 * opens the one-dialog quick tenancy flow (plan-slice-2b). "Bills" lists
 * active non-rent recurring charges on the unit (waste, water…) with their
 * collection frequency — same charge.list gate as Market Rent.
 */

import type { CardMapper, ColumnDef } from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Boxes, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react'

import { UnitStatusBadge } from '@/app/(dashboard)/portfolio/_components/unit-status'
import { chargeTypeLabel, frequencyLabel } from '@/lib/domain/charge-constants'
import { formatUnitKind } from '@/lib/domain/unit-constants'
import { MoneyCell, TenantCell, UnitCell } from './cells'
import type { UnitListRow } from './types'

export interface UnitColumnOptions {
  /** Global /units register — show the Property column + property name on cards. */
  showProperty: boolean
  /** tenant.read */
  showTenant: boolean
  /** charge.list */
  showRent: boolean
  /** charge.list — the "Bills" column (non-rent recurring charges). */
  showBills: boolean
  /** charge.list — the "Balance" column (per-unit pending vs paid). */
  showBalance: boolean
  onOpen?: (row: UnitListRow) => void
  onEdit?: (row: UnitListRow) => void
  onDelete?: (row: UnitListRow) => void
  /** Vacant rows only — jumps to the lease wizard with unitId prefilled. */
  onAddTenant?: (row: UnitListRow) => void
}

export function buildUnitColumns({
  showProperty,
  showTenant,
  showRent,
  showBills,
  showBalance,
  onOpen,
  onEdit,
  onDelete,
  onAddTenant,
}: UnitColumnOptions): {
  columns: ColumnDef<UnitListRow>[]
  cardMapper: CardMapper<UnitListRow>
} {
  const hasActions = Boolean(onOpen || onEdit || onDelete || onAddTenant)

  // Quick View + overflow menu (mirrors the property register row actions).
  const overflowActions: Array<{
    key: 'edit' | 'addTenant' | 'delete'
    label: string
    icon: typeof Pencil
    destructive?: boolean
    onSelect: (row: UnitListRow) => void
  }> = [
    ...(onEdit ? [{ key: 'edit' as const, label: 'Edit', icon: Pencil, onSelect: onEdit }] : []),
    ...(onAddTenant
      ? [{ key: 'addTenant' as const, label: 'Add tenant', icon: UserPlus, onSelect: onAddTenant }]
      : []),
    ...(onDelete
      ? [
          {
            key: 'delete' as const,
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ]

  const columns: ColumnDef<UnitListRow>[] = [
    ...(showProperty
      ? ([
          {
            header: 'Property',
            className: 'w-48',
            cell: (u) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{u.property?.name ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[u.property?.code, u.property?.locality].filter(Boolean).join(' · ') || ' '}
                </p>
              </div>
            ),
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
    {
      header: 'Unit',
      cell: (u) => <UnitCell row={u} showProperty={false} />,
    },
    {
      header: 'Type',
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral" size="sm">
            {formatUnitKind(u.unitType)}
          </Badge>
          {u.floor != null ? <span className="text-xs text-muted-foreground">Floor {u.floor}</span> : null}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (u) => <UnitStatusBadge status={u.occupancy} />,
    },
    ...(showTenant
      ? ([
          {
            header: 'Tenant',
            cell: (u) => <TenantCell occupant={u.occupant} />,
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
    ...(showRent
      ? ([
          {
            header: 'Market Rent',
            cell: (u) => (
              <MoneyCell
                value={u.occupant ? u.occupant.monthlyRent : u.defaultRent}
                currency={u.currency ?? u.property?.currency}
              />
            ),
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
    ...(showBills
      ? ([
          {
            header: 'Bills',
            className: 'w-44',
            cell: (u) => {
              const bills = u.bills ?? []
              if (bills.length === 0) return <span className="text-sm text-muted-foreground">—</span>
              const shown = bills.slice(0, 2)
              return (
                <div className="flex flex-col gap-1">
                  {shown.map((b) => (
                    <span key={b.id} className="truncate text-xs" title={`${b.name} · ${chargeTypeLabel(b.chargeType)} · ${frequencyLabel(b.frequency)}`}>
                      {chargeTypeLabel(b.chargeType)} · {frequencyLabel(b.frequency).toLowerCase()} · {b.currency}{' '}
                      {Number(b.amount).toLocaleString()}
                    </span>
                  ))}
                  {bills.length > 2 ? (
                    <span className="text-xs text-muted-foreground">+{bills.length - 2} more</span>
                  ) : null}
                </div>
              )
            },
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
    ...(showBalance
      ? ([
          {
            header: 'Balance',
            cell: (u) => {
              const bal = u.balance
              if (!bal) return <span className="text-sm text-muted-foreground">—</span>
              const pending = Number(bal.pending)
              const paid = Number(bal.paid)
              if (pending <= 0.009 && paid <= 0.009) {
                return <span className="text-sm text-muted-foreground">—</span>
              }
              return (
                <div className="flex flex-col gap-0.5 text-xs">
                  {pending > 0.009 ? (
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      {bal.currency} {pending.toLocaleString()} due
                    </span>
                  ) : null}
                  {paid > 0.009 ? (
                    <span className="text-muted-foreground">
                      {bal.currency} {paid.toLocaleString()} paid
                    </span>
                  ) : null}
                </div>
              )
            },
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
    ...(hasActions
      ? ([
          {
            header: '',
            className: 'w-32',
            cell: (u) => {
              const items = overflowActions.filter(
                (a) => a.key !== 'addTenant' || u.occupancy === 'VACANT',
              )
              return (
                <div className="flex items-center justify-end gap-1">
                  {onOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpen(u)}
                      aria-label={`View unit ${u.unitRef}`}
                    >
                      View
                    </Button>
                  ) : null}
                  {items.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-lg"
                          aria-label={`Actions for unit ${u.unitRef}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 min-w-0">
                        {items.map((item) => (
                          <DropdownMenuItem
                            key={item.key}
                            variant={item.destructive ? 'destructive' : 'default'}
                            onSelect={() => item.onSelect(u)}
                          >
                            <item.icon className="size-4" />
                            {item.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              )
            },
          },
        ] as ColumnDef<UnitListRow>[])
      : []),
  ]

  const cardMapper: CardMapper<UnitListRow> = {
    id: (u) => u.id,
    title: (u) => u.unitRef,
    subtitle: (u) =>
      [
        showProperty ? u.property?.name : null,
        u.label,
        u.building ? [u.building.code, u.building.name].filter(Boolean).join(' ') : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    fallbackIcon: () => <Boxes className="size-4" />,
    statusBadge: (u) => <UnitStatusBadge status={u.occupancy} />,
    detailFields: (u) => {
      const fields: { label: string; value: string }[] = [
        { label: 'Kind', value: formatUnitKind(u.unitType) },
      ]
      if (showTenant) fields.push({ label: 'Tenant', value: u.occupant?.displayName ?? 'Vacant' })
      if (showRent) {
        fields.push({
          label: 'Rent',
          value: u.occupant
            ? // MoneyCell handles null; keep card text simple
              (u.occupant.monthlyRent ?? '—')
            : u.defaultRent != null
              ? String(u.defaultRent)
              : '—',
        })
      }
      if (showBills && (u.bills ?? []).length > 0) {
        fields.push({
          label: 'Bills',
          value: (u.bills ?? [])
            .map((b) => `${chargeTypeLabel(b.chargeType)} (${frequencyLabel(b.frequency).toLowerCase()})`)
            .join(', '),
        })
      }
      if (showBalance && u.balance && Number(u.balance.pending) > 0.009) {
        fields.push({
          label: 'Balance due',
          value: `${u.balance.currency} ${Number(u.balance.pending).toLocaleString()}`,
        })
      }
      return fields
    },
    actions: (u) => {
      const acts: { label: string; variant?: 'outline' | 'destructive'; onClick: () => void }[] = []
      if (onOpen) acts.push({ label: 'View', variant: 'outline', onClick: () => onOpen(u) })
      if (onEdit) acts.push({ label: 'Edit', variant: 'outline', onClick: () => onEdit(u) })
      if (onAddTenant && u.occupancy === 'VACANT')
        acts.push({ label: 'Add tenant', variant: 'outline', onClick: () => onAddTenant(u) })
      if (onDelete) acts.push({ label: 'Delete', variant: 'destructive', onClick: () => onDelete(u) })
      return acts
    },
  }

  return { columns, cardMapper }
}
