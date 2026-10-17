'use client'

/**
 * Roles & Permissions — read-only view of the active organization's roles.
 *
 * ACCOUNT-KIND SPECIFIC: the API scopes roles to the caller's active
 * organization, and each org is seeded only with its kind's templates
 * (landlord → owner/manager/viewer; property management → owner/admin/
 * property_manager/…; maintenance → owner/admin/coordinator/technician/
 * viewer). A landlord never sees PM-only roles.
 *
 * UI permission `role.read` gates the view (UX only — the server gate is
 * /api/roles itself). Role create/edit is a later increment; today the
 * matrix dialog is read-only (checked = granted, grouped by resource).
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import {
  ResponsiveDataListing,
  type ColumnDef,
  type CardMapper,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { RolePermissionsDialog } from './_components/role-permissions-dialog'
import {
  roleType,
  roleTypeLabel,
  roleTypeVariant,
  type PermissionInfo,
  type Role,
} from './_components/types'

export default function RolesPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<PermissionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [viewing, setViewing] = useState<Role | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/roles', { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error('Failed to load roles')
        const data = await res.json()
        return (data.roles ?? []) as Role[]
      }),
      fetch('/api/permissions', { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error('Failed to load permissions')
        const data = await res.json()
        return (data.permissions ?? []) as PermissionInfo[]
      }),
    ])
      .then(([roleList, permissionList]) => {
        if (!cancelled) {
          setRoles(roleList)
          setPermissions(permissionList)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load roles')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = roles
    if (typeFilter) {
      list = list.filter((r) => roleType(r) === typeFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.slug.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          r.permissions.some((p) => p.toLowerCase().includes(q)),
      )
    }
    return list
  }, [roles, search, typeFilter])

  // ── Listing shape ────────────────────────────────────────────────────────────

  const columns: ColumnDef<Role>[] = [
    {
      header: 'Role',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.description ?? r.slug}</p>
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={roleTypeVariant(r)} size="sm">
            {roleTypeLabel(r)}
          </Badge>
          {r.singleOrg && (
            <Badge variant="warning" size="sm">
              One org
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Members',
      cell: (r) => <span className="tabular-nums">{r.memberCount}</span>,
    },
    {
      header: 'Permissions',
      cell: (r) => (
        <Badge variant="outline" size="sm">
          {r.permissions.length} permissions
        </Badge>
      ),
    },
    {
      header: '',
      className: 'w-24',
      cell: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewing(r)}
          aria-label={`View permissions for ${r.name}`}
        >
          View
        </Button>
      ),
    },
  ]

  const cardMapper: CardMapper<Role> = {
    id: (r) => r.id,
    title: (r) => r.name,
    subtitle: (r) => r.description ?? undefined,
    statusBadge: (r) => (
      <Badge variant={roleTypeVariant(r)} size="sm">
        {roleTypeLabel(r)}
      </Badge>
    ),
    detailFields: (r) => [
      { label: 'Members', value: r.memberCount },
      { label: 'Permissions', value: `${r.permissions.length} permissions` },
    ],
    actions: (r) => [{ label: 'View', variant: 'outline', onClick: () => setViewing(r) }],
  }

  // ── Access gate (UX only; /api/roles is the real server gate) ────────────────

  if (!hasUiPermission('role.read')) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card variant="outlined" size="lg" className="max-w-md items-center text-center">
          <Text variant="headline" as="h1">
            Access denied
          </Text>
          <Text variant="bodyMuted">
            You need the role.read permission to view roles and permissions. Ask an owner or
            admin of your organization.
          </Text>
          <Button variant="outline" className="mt-2" onClick={() => router.push('/')}>
            Back to Overview
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ResponsiveDataListing<Role>
        title="Roles & Permissions"
        description="Roles for this workspace — seeded from its organization kind. Permissions are read-only for now."
        count={roles.length}
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={4}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search roles or permissions"
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: '', label: 'All types' },
              { value: 'SYSTEM', label: 'System' },
              { value: 'TEMPLATE', label: 'Template' },
              { value: 'CUSTOM', label: 'Custom' },
            ],
          },
        ]}
        filterChips
        rowKey={(r) => r.id}
        emptyState={{
          icon: KeyRound,
          title: 'No roles found',
          description: 'Roles appear here once your workspace kind is seeded.',
        }}
      />

      <RolePermissionsDialog
        role={viewing}
        permissions={permissions}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
      />
    </div>
  )
}
