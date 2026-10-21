/**
 * Unit register columns + mobile card mapper (siso-design portfolio.webp).
 * Property column only on the global /units register; Tenant respects the
 * tenant.read UI gate; Market Rent prefers the live lease unit rent and falls
 * back to the unit's template default. "Add tenant" appears on vacant rows and
 * jumps into the lease wizard with the unit prefilled (plan decision).
 */

import type { CardMapper, ColumnDef } from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Boxes } from 'lucide-react'

import { UnitStatusBadge } from '@/app/(dashboard)/portfolio/_components/unit-status'
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
  onOpen,
  onEdit,
  onDelete,
  onAddTenant,
}: UnitColumnOptions): {
  columns: ColumnDef<UnitListRow>[]
  cardMapper: CardMapper<UnitListRow>
} {
  const hasActions = Boolean(onOpen || onEdit || onDelete || onAddTenant)

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
    ...(hasActions
      ? ([
          {
            header: '',
            className: 'w-48',
            cell: (u) => (
              <div className="flex justify-end gap-2">
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
                {onEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(u)}
                    aria-label={`Edit unit ${u.unitRef}`}
                  >
                    Edit
                  </Button>
                ) : null}
                {onAddTenant && u.occupancy === 'VACANT' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onAddTenant(u)}
                    aria-label={`Add tenant to unit ${u.unitRef}`}
                  >
                    Add tenant
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onDelete(u)}
                    aria-label={`Delete unit ${u.unitRef}`}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ),
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
