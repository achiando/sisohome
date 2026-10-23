/**
 * Shared tenant directory columns + mobile card mapper. Used by BOTH the
 * People → Tenants register and the property detail Tenants section, so the
 * two listings stay visually identical (siso-design). Row actions follow the
 * same quick-View + overflow-dropdown pattern as the property/unit registers.
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
import { MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { TenantPortalBadge, TenantStatusBadge } from '@/app/(dashboard)/leasing/_components/tenant-status'

export type TenantListRow = {
  id: string
  tenantRef: string | null
  displayName: string
  partyType: string
  phone: string | null
  email: string | null
  status: string
  portalStatus: string
  incomeVerified: boolean
  createdAt: string
  leases: { id: string; status: string }[]
}

export interface TenantColumnOptions {
  /** Show the Portal column/badge (People register does; property view may not). */
  showPortal?: boolean
  onOpen?: (row: TenantListRow) => void
  onEdit?: (row: TenantListRow) => void
  onDelete?: (row: TenantListRow) => void
}

/** ACTIVE/ENDING lease status label, or an em dash. */
export function activeLeaseLabel(t: TenantListRow): string {
  const active = t.leases.find((l) => l.status === 'ACTIVE' || l.status === 'ENDING')
  return active ? active.status : '—'
}

export function buildTenantColumns({
  showPortal = true,
  onOpen,
  onEdit,
  onDelete,
}: TenantColumnOptions): {
  columns: ColumnDef<TenantListRow>[]
  cardMapper: CardMapper<TenantListRow>
} {
  const hasActions = Boolean(onOpen || onEdit || onDelete)
  const overflowActions: Array<{
    key: 'edit' | 'delete'
    label: string
    icon: typeof Pencil
    destructive?: boolean
    onSelect: (row: TenantListRow) => void
  }> = [
    ...(onEdit ? [{ key: 'edit' as const, label: 'Edit', icon: Pencil, onSelect: onEdit }] : []),
    ...(onDelete
      ? [{ key: 'delete' as const, label: 'Delete', icon: Trash2, destructive: true, onSelect: onDelete }]
      : []),
  ]

  const columns: ColumnDef<TenantListRow>[] = [
    {
      header: 'Tenant',
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-medium">{t.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {[t.tenantRef, t.email ?? t.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    { header: 'Phone', cell: (t) => <span className="text-sm tabular-nums">{t.phone ?? '—'}</span> },
    { header: 'Status', cell: (t) => <TenantStatusBadge status={t.status} /> },
    ...(showPortal
      ? ([
          { header: 'Portal', cell: (t) => <TenantPortalBadge status={t.portalStatus} /> },
        ] as ColumnDef<TenantListRow>[])
      : []),
    {
      header: 'Lease',
      cell: (t) => <Badge variant="neutral" size="sm">{activeLeaseLabel(t)}</Badge>,
    },
    {
      header: 'Added',
      cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.createdAt)}</span>,
    },
    ...(hasActions
      ? ([
          {
            header: '',
            className: 'w-32',
            cell: (t) => (
              <div className="flex items-center justify-end gap-1">
                {onOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpen(t)}
                    aria-label={`Open ${t.displayName}`}
                  >
                    Open
                  </Button>
                ) : null}
                {overflowActions.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg"
                        aria-label={`Actions for ${t.displayName}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 min-w-0">
                      {overflowActions.map((item) => (
                        <DropdownMenuItem
                          key={item.key}
                          variant={item.destructive ? 'destructive' : 'default'}
                          onSelect={() => item.onSelect(t)}
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
        ] as ColumnDef<TenantListRow>[])
      : []),
  ]

  const cardMapper: CardMapper<TenantListRow> = {
    id: (t) => t.id,
    title: (t) => t.displayName,
    subtitle: (t) => [t.tenantRef, t.email ?? t.phone].filter(Boolean).join(' · ') || undefined,
    fallbackIcon: () => <Users className="size-4" />,
    statusBadge: (t) => <TenantStatusBadge status={t.status} />,
    detailFields: (t) => [
      ...(showPortal
        ? [{ label: 'Portal', value: t.portalStatus.replace(/_/g, ' ').toLowerCase() }]
        : []),
      { label: 'Lease', value: activeLeaseLabel(t) },
    ],
    actions: (t) => {
      const acts: { label: string; variant?: 'outline' | 'destructive'; onClick: () => void }[] = []
      if (onOpen) acts.push({ label: 'Open', variant: 'outline', onClick: () => onOpen(t) })
      if (onEdit) acts.push({ label: 'Edit', variant: 'outline', onClick: () => onEdit(t) })
      if (onDelete) acts.push({ label: 'Delete', variant: 'destructive', onClick: () => onDelete(t) })
      return acts
    },
  }

  return { columns, cardMapper }
}
