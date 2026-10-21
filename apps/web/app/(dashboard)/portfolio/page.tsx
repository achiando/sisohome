'use client'

/**
 * /portfolio — property index (plan-slice-1 §4.1, redesigned per
 * siso-design/portfolio-property.webp): standard listing kit columns,
 * inline filter dropdowns, lease-derived occupancy ring, DERIVED balance
 * (charge.list), Owner/Agreement columns (hidden for LANDLORD workspaces),
 * and a per-row overflow menu (edit/add unit/add tenant/upload media/
 * archive/delete draft). Owners/Agreements also live in the sidebar sub-nav.
 *
 * UX gates: `property.list` (ScopeDenied fallback), Add property
 * `property.create`; each row action maps to its own permission boolean.
 * Server gate = the API routes themselves.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Button } from '@workspace/ui/components/button'
import { toast } from '@workspace/ui/components/toast'
import {
  buildPropertyColumns,
  type PropertyListRow,
  type PropertyRowAction,
} from '@/app/(dashboard)/_components/domain/listing'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { PROPERTY_CATEGORIES, PROPERTY_STATUSES } from '@/lib/domain/property-constants'

export default function PortfolioPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [properties, setProperties] = useState<PropertyListRow[]>([])
  const [organizationKind, setOrganizationKind] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PropertyListRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/properties', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load properties')
        const data = await res.json()
        return {
          list: (data.properties ?? []) as PropertyListRow[],
          kind: (data.organizationKind ?? null) as string | null,
        }
      })
      .then(({ list, kind }) => {
        if (cancelled) return
        setProperties(list)
        setOrganizationKind(kind)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load properties')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const refresh = useCallback(() => {
    setLoading(true)
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = properties
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code ?? '').toLowerCase().includes(q) ||
          (p.locality ?? '').toLowerCase().includes(q) ||
          (p.addressLine1 ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [properties, search, statusFilter, categoryFilter])

  if (!hasUiPermission('property.list')) {
    return (
      <ScopeDenied
        message="You need the property.list permission to view the portfolio. Ask an owner or admin of your organization."
      />
    )
  }

  const runStatus = useCallback(
    async (row: PropertyListRow, kind: 'archive' | 'unarchive') => {
      try {
        const res = await fetch(`/api/properties/${row.id}/${kind}`, {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.error ?? `Failed to ${kind} property`)
          return
        }
        toast.success(kind === 'archive' ? 'Property archived' : 'Property unarchived')
        refresh()
      } catch {
        toast.error('Network error')
      }
    },
    [refresh],
  )

  const handleAction = useCallback(
    (action: PropertyRowAction, row: PropertyListRow) => {
      switch (action) {
        case 'view':
          router.push(`/portfolio/${row.id}`)
          break
        case 'edit':
          router.push(`/portfolio/${row.id}/edit`)
          break
        case 'addUnit':
          router.push(`/portfolio/${row.id}/units/new`)
          break
        case 'addTenant':
          router.push(`/leasing/leases/new?propertyId=${row.id}`)
          break
        case 'uploadMedia':
          router.push(`/portfolio/${row.id}?tab=media`)
          break
        case 'archive':
          void runStatus(row, 'archive')
          break
        case 'unarchive':
          void runStatus(row, 'unarchive')
          break
        case 'delete':
          setDeleteTarget(row)
          break
      }
    },
    [router, runStatus],
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/properties/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete property')
        return
      }
      toast.success('Property deleted')
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const { columns, cardMapper } = buildPropertyColumns({
    showMoney: hasUiPermission('charge.list'),
    showOwner: organizationKind !== null && organizationKind !== 'LANDLORD',
    showAgreement: organizationKind !== null && organizationKind !== 'LANDLORD',
    can: {
      edit: hasUiPermission('property.update'),
      addUnit: hasUiPermission('unit.create'),
      addTenant: hasUiPermission('lease.create'),
      uploadMedia: hasUiPermission('document.upload'),
      archive: hasUiPermission('property.archive'),
      unarchive: hasUiPermission('property.update'),
      delete: hasUiPermission('property.delete'),
    },
    onAction: handleAction,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Properties your organization owns or manages."
        actions={
          hasUiPermission('property.create') ? (
            <Button variant="primary" onClick={() => router.push('/portfolio/new')}>
              Add property
            </Button>
          ) : undefined
        }
      />

      <ResponsiveDataListing<PropertyListRow>
        title="Properties"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        count={properties.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, code or locality"
        filters={[
          {
            key: 'category',
            label: 'Property Type',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [{ value: '', label: 'Property Type' }, ...PROPERTY_CATEGORIES],
          },
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: '', label: 'Status' }, ...PROPERTY_STATUSES],
          },
        ]}
        inlineFilters
        rowKey={(p) => p.id}
        emptyState={{
          icon: Building2,
          title: 'No properties yet',
          description:
            properties.length > 0
              ? 'No properties match these filters.'
              : 'Add your first property to start building the portfolio.',
        }}
        primaryAction={
          hasUiPermission('property.create')
            ? { label: 'Add property', onClick: () => router.push('/portfolio/new') }
            : undefined
        }
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => (!open && !deleteBusy ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only draft properties can be deleted, and only while they have no units, leases or
              agreements. This cannot be undone — archive instead to retire a property with history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteBusy} onClick={(e) => { e.preventDefault(); void confirmDelete() }}>
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
