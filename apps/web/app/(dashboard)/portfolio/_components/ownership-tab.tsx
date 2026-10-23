'use client'

/**
 * OwnershipTab — property-level ownership rows + share bars (plan-slice-1
 * §2.1, §4.2). Unit-level rows (unitId set) show under a "Units" divider.
 * Shares render as a horizontal bar over the 100% budget; edits ride the
 * dialog and the API re-validates the ≤100 budget (400 surfaced as toast).
 */

import { useMemo, useState } from 'react'
import { Users, Plus, Pencil, Trash2 } from 'lucide-react'
import type { SelectOption } from '@workspace/ui/types/components'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { OwnershipDialog, type OwnershipRow } from './ownership-dialog'

/** Owner-party select option (shared with the property page's fetch-all). */
export type OwnerPartyOption = { id: string; name: string; partyType: string }

export type OwnershipTabRow = OwnershipRow & {
  propertyId?: string | null
  unitId?: string | null
}

type PartyOption = OwnerPartyOption
type Row = OwnershipTabRow

function shareBar(share: number) {
  const pct = Math.max(0, Math.min(100, share))
  const over = pct >= 100
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-sm">{share}%</span>
    </div>
  )
}

function OwnershipRowItem({
  row,
  canEdit,
  onEdit,
  onDelete,
}: {
  row: Row
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const window = [formatDate(row.startsAt), row.endsAt ? formatDate(row.endsAt) : 'current']
    .filter(Boolean)
    .join(' → ')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{row.ownerParty?.name ?? row.ownerPartyId}</p>
          {row.ownerParty ? <Badge variant="neutral" size="sm">{row.ownerParty.partyType.toLowerCase()}</Badge> : null}
          {row.unit ? <Badge variant="outline" size="sm">Unit {row.unit.unitRef}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {[row.titleNumber ? `Title ${row.titleNumber}` : null, window].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {shareBar(Number(row.sharePercent))}
        {canEdit ? (
          <>
            <Button variant="ghost" size="icon-sm" leftIcon={Pencil} onClick={onEdit} aria-label="Edit ownership" />
            <Button variant="ghost" size="icon-sm" leftIcon={Trash2} onClick={onDelete} aria-label="Remove ownership" />
          </>
        ) : null}
      </div>
    </div>
  )
}

export function OwnershipTab({
  propertyId,
  rows,
  parties,
  loading,
  onRefresh,
}: {
  propertyId: string
  rows: Row[]
  parties: PartyOption[]
  loading: boolean
  onRefresh: () => void
}) {
  const { hasUiPermission } = useUiPermission()
  const [dialog, setDialog] = useState<{ open: boolean; row?: Row | null }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)

  const partyOptions: SelectOption[] = useMemo(
    () => parties.map((p) => ({ value: p.id, label: p.name })),
    [parties],
  )

  const propertyRows = rows.filter((r) => r.propertyId === propertyId && !r.unitId)
  const unitRows = rows.filter((r) => r.propertyId === propertyId && r.unitId)
  const activePropertyTotal = propertyRows
    .filter((r) => !r.endsAt || new Date(r.endsAt) > new Date())
    .reduce((sum, r) => sum + Number(r.sharePercent || 0), 0)

  const canWrite = hasUiPermission('ownership.create')

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ownerships/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to remove ownership')
        return
      }
      toast.success('Ownership removed')
      setDeleteTarget(null)
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader title="Loading ownership…" description="" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text variant="title">Ownership</Text>
          <Text variant="bodyMuted">
            Active property-level shares total {activePropertyTotal}% of 100.
          </Text>
        </div>
        {canWrite ? (
          <Button variant="primary" leftIcon={Plus} onClick={() => setDialog({ open: true })}>
            Add owner
          </Button>
        ) : null}
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Property owners
          </CardTitle>
        </CardHeader>
        <CardContent>
          {propertyRows.length === 0 ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                No owners recorded yet. Add owner parties and split the property into shares.
              </p>
              {canWrite ? (
                <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setDialog({ open: true })}>
                  Add owner
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {propertyRows.map((row) => (
                <OwnershipRowItem
                  key={row.id}
                  row={row}
                  canEdit={hasUiPermission('ownership.update')}
                  onEdit={() => setDialog({ open: true, row })}
                  onDelete={() => setDeleteTarget(row)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {unitRows.length > 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Unit-level shares</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {unitRows.map((row) => (
              <OwnershipRowItem
                key={row.id}
                row={row}
                canEdit={hasUiPermission('ownership.update')}
                onEdit={() => setDialog({ open: true, row })}
                onDelete={() => setDeleteTarget(row)}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <OwnershipDialog
        open={dialog.open}
        partyOptions={partyOptions}
        propertyId={propertyId}
        row={dialog.row}
        onClose={() => setDialog({ open: false })}
        onSaved={onRefresh}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              The share held by {deleteTarget?.ownerParty?.name ?? 'this party'} will be removed. The
              action is kept in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDelete()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
