/**
 * Standard cell renderers for portfolio registers (siso-design
 * portfolio-property.webp / portfolio.webp): property thumb + name, unit ref,
 * tenant with joint count, occupancy ring, money. Reused by the properties
 * and units column builders so both registers (and the per-property units
 * panel) share one visual language.
 */

import { Building2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { CircularLoader } from '@workspace/ui/components/loader'
import { cn } from '@workspace/ui/lib/utils'
import { formatMoney } from '@/app/(dashboard)/_components/domain/format'
import type { PropertyListRow, UnitListOccupant, UnitListRow } from './types'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Cover thumbnail slot. `coverUrl` is the cover document's Cloudinary
 * secure URL (uploaded media is registered as document rows); without one,
 * the icon tile carries the visual weight.
 */
export function CoverThumb({
  name,
  coverUrl,
  className,
}: {
  name: string
  coverUrl?: string | null
  className?: string
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn('size-10 shrink-0 rounded-lg border border-border/60 object-cover', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      <Building2 className="size-4.5" />
      <span className="sr-only">{name}</span>
    </span>
  )
}

export function PropertyCell({ row }: { row: Pick<PropertyListRow, 'name' | 'code' | 'locality' | 'addressLine1' | 'coverPhoto'> }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CoverThumb name={row.name} coverUrl={row.coverPhoto} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[row.code, row.locality ?? row.addressLine1].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
    </div>
  )
}

export function UnitCell({
  row,
  showProperty = false,
}: {
  row: Pick<UnitListRow, 'unitRef' | 'label' | 'floor' | 'building' | 'property'>
  showProperty?: boolean
}) {
  return (
    <div className="min-w-0">
      {showProperty && row.property ? (
        <p className="truncate text-xs font-medium text-foreground">{row.property.name}</p>
      ) : null}
      <p className="truncate font-medium text-foreground">{row.unitRef}</p>
      <p className="truncate text-xs text-muted-foreground">
        {[
          row.label,
          row.building ? [row.building.code, row.building.name].filter(Boolean).join(' ') : null,
          row.floor != null && !row.building ? `Floor ${row.floor}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—'}
      </p>
    </div>
  )
}

export function TenantCell({ occupant }: { occupant: UnitListOccupant | null }) {
  if (!occupant) {
    return <span className="text-sm text-muted-foreground">Vacant</span>
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback>{initials(occupant.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{occupant.displayName}</p>
        {occupant.jointCount > 0 ? (
          <Badge variant="neutral" size="sm">
            +{occupant.jointCount}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

export function OccupancyRing({
  rate,
  occupied,
  total,
}: {
  rate: number
  occupied: number
  total: number
}) {
  return (
    <div className="flex items-center gap-2">
      <CircularLoader
        value={rate}
        size="sm"
        variant="primary"
        role="img"
        aria-label={`Occupancy ${rate}%`}
        label={`${rate}%`}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {occupied}/{total}
      </span>
    </div>
  )
}

export function MoneyCell({
  value,
  currency,
  className,
}: {
  value: number | string | { toString(): string } | null | undefined
  currency?: string | null
  className?: string
}) {
  if (value == null || value === '') return <span className={cn('text-muted-foreground', className)}>—</span>
  return <span className={cn('tabular-nums', className)}>{formatMoney(value, currency ?? undefined)}</span>
}
