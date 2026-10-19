'use client'

/**
 * People — member management for the active organization.
 *
 * One form handles both create and edit (see _components/member-form.tsx).
 * The server is the real gate (user.read / user.create + membership.invite /
 * membership.manage / role.assign / role.revoke); UI permission checks here
 * are a UX convenience only. Removals show an undo snackbar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@workspace/auth-ui'
import {
  ResponsiveDataListing,
  type ColumnDef,
  type CardMapper,
} from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { toast } from '@workspace/ui/components/toast'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { Users, UserPlus, UserCheck, UserX } from 'lucide-react'
import {
  MemberForm,
  type MemberFormSubmit,
} from './_components/member-form'
import { TempPasswordDialog } from './_components/temp-password-dialog'
import { MemberRowActions, type MemberAction } from './_components/member-row-actions'
import { UndoSnackbar } from './_components/undo-snackbar'
import {
  emailDomainHint,
  statusLabel,
  statusVariant,
  type Member,
  type Role,
} from './_components/types'

export default function PeoplePage() {
  const { user } = useAuth()
  const { hasUiPermission } = useUiPermission()

  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Shared form state for both create and edit.
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<Member | null>(null)
  const [saving, setSaving] = useState(false)

  // One-time temp password after create.
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  // Undo state for remove.
  const [pendingUndo, setPendingUndo] = useState<{
    membershipId: string
    previousStatus: string
    name: string
  } | null>(null)

  const orgDomain = useMemo(() => emailDomainHint(user?.email ?? null), [user?.email])

  // ── Data ────────────────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      setMembers(data.members ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load members')
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setRoles(data.roles ?? [])
    } catch {
      // best-effort
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      await Promise.all([fetchMembers(), fetchRoles()])
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [fetchMembers, fetchRoles])

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = members
    if (statusFilter) {
      list = list.filter((m) => m.status.toUpperCase() === statusFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (m) =>
          (m.name ?? '').toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.roles.some((r) => r.name.toLowerCase().includes(q))
      )
    }
    return list
  }, [members, search, statusFilter])

  // ── Status mutations (optimistic, revert on failure) ────────────────────────

  const setMemberStatus = useCallback(
    async (membershipId: string, nextStatus: string) => {
      const res = await fetch(`/api/members/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update member')
      }
    },
    []
  )

  const applyStatus = useCallback(
    async (
      member: Member,
      nextStatus: 'ACTIVE' | 'SUSPENDED' | 'REMOVED',
      { showUndo = false } = {}
    ) => {
      const previousStatus = member.status
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === member.membershipId ? { ...m, status: nextStatus } : m
        )
      )
      try {
        await setMemberStatus(member.membershipId, nextStatus)
        if (nextStatus === 'REMOVED') {
          if (showUndo) {
            setPendingUndo({
              membershipId: member.membershipId,
              previousStatus,
              name: member.name ?? member.email,
            })
          }
          toast.success('Member removed')
        } else if (nextStatus === 'SUSPENDED') {
          toast.success('Member suspended')
        } else {
          toast.success('Member reactivated')
        }
      } catch (err) {
        setMembers((prev) =>
          prev.map((m) =>
            m.membershipId === member.membershipId ? { ...m, status: previousStatus } : m
          )
        )
        toast.error(err instanceof Error ? err.message : 'Failed to update member')
      }
    },
    [setMemberStatus]
  )

  const handleUndo = useCallback(async () => {
    if (!pendingUndo) return
    const { membershipId, previousStatus } = pendingUndo
    try {
      await setMemberStatus(membershipId, previousStatus)
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === membershipId ? { ...m, status: previousStatus } : m
        )
      )
      toast.success('Removal undone')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to undo')
    } finally {
      setPendingUndo(null)
    }
  }, [pendingUndo, setMemberStatus])

  // ── Form open/close ─────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setFormMode('create')
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((member: Member) => {
    setFormMode('edit')
    setEditing(member)
    setFormOpen(true)
  }, [])

  // ── Submit (shared for create + edit) ──────────────────────────────────────

  const handleSubmit = useCallback(
    async (values: MemberFormSubmit) => {
      setSaving(true)
      try {
        if (formMode === 'create') {
          const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: values.name,
              email: values.email,
              roleIds: [values.roleId],
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || 'Failed to create member')
          await fetchMembers()
          setFormOpen(false)
          setCreatedEmail(values.email)
          setTempPassword(data.tempPassword)
        } else if (editing) {
          // Name change: PATCH only when it actually changed (email is locked).
          if (values.name !== (editing.name ?? '')) {
            const res = await fetch(`/api/members/${editing.membershipId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ name: values.name }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to update name')
            }
          }

          // Role diff: assign newly added roles, revoke removed ones.
          const currentRoleIds = new Set(editing.roles.map((r) => r.id))
          const nextRoleIds = new Set([values.roleId])
          const toAssign = [...nextRoleIds].filter((id) => !currentRoleIds.has(id))
          const toRevoke = [...currentRoleIds].filter((id) => !nextRoleIds.has(id))

          if (toAssign.length) {
            const res = await fetch(`/api/members/${editing.membershipId}/roles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ roleIds: toAssign }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to assign role')
            }
          }
          if (toRevoke.length) {
            const res = await fetch(`/api/members/${editing.membershipId}/roles`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ roleIds: toRevoke }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to revoke role')
            }
          }

          await fetchMembers()
          setFormOpen(false)
          toast.success('Member updated')
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save member')
      } finally {
        setSaving(false)
      }
    },
    [formMode, editing, fetchMembers]
  )

  // ── Row action dispatch ─────────────────────────────────────────────────────

  const handleRowAction = useCallback(
    (action: MemberAction, member: Member) => {
      switch (action) {
        case 'edit':
          openEdit(member)
          break
        case 'suspend':
          void applyStatus(member, 'SUSPENDED')
          break
        case 'reactivate':
          void applyStatus(member, 'ACTIVE')
          break
        case 'remove':
          void applyStatus(member, 'REMOVED', { showUndo: true })
          break
      }
    },
    [openEdit, applyStatus]
  )

  // ── Columns & card mapper ───────────────────────────────────────────────────

  const columns: ColumnDef<Member>[] = [
    {
      header: 'Member',
      cell: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">
            {(m.name ?? m.email).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{m.name ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Roles',
      cell: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.roles.map((r) => (
            <Badge key={r.id} variant="outline" className="text-xs">
              {r.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (m) => (
        <Badge variant={statusVariant(m.status)} className="text-xs">
          {statusLabel(m.status)}
        </Badge>
      ),
    },
    {
      header: 'Joined',
      cell: (m) => (
        <span className="text-sm text-muted-foreground">
          {new Date(m.joinedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (m) => <MemberRowActions member={m} onSelect={handleRowAction} />,
    },
  ]

  const cardMapper: CardMapper<Member> = {
    id: (m) => m.membershipId,
    title: (m) => m.name ?? m.email,
    subtitle: (m) => m.email,
    fallbackIcon: () => <Users className="size-5" />,
    statusBadge: (m) => (
      <Badge variant={statusVariant(m.status)} className="text-xs">
        {statusLabel(m.status)}
      </Badge>
    ),
    detailFields: (m) => [
      { label: 'Roles', value: m.roles.map((r) => r.name).join(', ') || '—' },
      { label: 'Joined', value: new Date(m.joinedAt).toLocaleDateString() },
    ],
    actions: (m) => [
      ...(hasUiPermission('membership.manage') && m.status !== 'REMOVED'
        ? [
            {
              label: m.status === 'ACTIVE' ? 'Suspend' : 'Reactivate',
              icon: m.status === 'ACTIVE' ? UserX : UserCheck,
              onClick: () =>
                applyStatus(m, m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'),
            },
          ]
        : []),
    ],
  }

  const canCreate =
    hasUiPermission('user.create') && hasUiPermission('membership.invite')

  return (
    <div className="space-y-6">
      <ResponsiveDataListing<Member>
        title="People"
        description="Manage members of your organization"
        count={members.length}
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={5}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or role"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'REMOVED', label: 'Removed' },
            ],
          },
        ]}
        filterChips
        rowKey={(m) => m.membershipId}
        primaryAction={
          canCreate
            ? { label: 'Add member', icon: UserPlus, onClick: openCreate }
            : undefined
        }
      />

      {pendingUndo && (
        <UndoSnackbar
          message={`${pendingUndo.name} removed`}
          onUndo={handleUndo}
          onDismiss={() => setPendingUndo(null)}
        />
      )}

      {/* Shared create/edit form */}
      {/* key remounts the form so local state re-seeds per member/mode */}
      <MemberForm
        key={editing?.membershipId ?? 'create'}
        open={formOpen}
        mode={formMode}
        member={editing}
        roles={roles}
        orgDomain={orgDomain}
        saving={saving}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
      />

      {/* One-time temp password after create */}
      {tempPassword && createdEmail && (
        <TempPasswordDialog
          open
          email={createdEmail}
          tempPassword={tempPassword}
          onClose={() => {
            setTempPassword(null)
            setCreatedEmail(null)
          }}
        />
      )}
    </div>
  )
}
