'use client'

/**
 * ManagementTab — agreements for this property + staff assignments
 * (plan-slice-1 §2.2–2.3, §4.2).
 *
 * Agreements: dual-entry inbox — DRAFT rows show an Approve action when the
 * caller is on the portfolio side (flag from the API), END when active.
 * Staff: assign/revoke (arm 3 from startsAt; revoke flips isActive=false).
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, Plus, UserPlus, XCircle, CheckCircle2, StopCircle } from 'lucide-react'
import type { AgreementStatus } from '@workspace/database'
import type { SelectOption } from '@workspace/ui/types/components'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AgreementStatusBadge } from './agreement-status'
import { ApproveAgreementDialog } from './approve-agreement-dialog'
import { StaffDialog } from './staff-dialog'

export type AgreementRow = {
  id: string
  status: AgreementStatus
  startsAt: string
  endsAt: string | null
  actorIsPortfolioSide: boolean
  managementOrganization: { id: string; name: string; kind?: string | null } | null
  ownerParty?: { id: string; name: string } | null
  scope?: unknown
}

export type MemberOption = { userId: string; name?: string | null; email?: string | null }
export type AssignmentRow = {
  id: string
  isActive: boolean
  title?: string | null
  startsAt: string
  endsAt?: string | null
  user: { id: string; displayName?: string | null; email?: string } | null
}

function scopeNotes(scope: unknown): string {
  if (scope && typeof scope === 'object' && !Array.isArray(scope)) {
    const notes = (scope as { notes?: unknown }).notes
    return typeof notes === 'string' ? notes : ''
  }
  return ''
}

export function ManagementTab({
  propertyId,
  agreements,
  assignments,
  members,
  loading,
  onRefresh,
}: {
  propertyId: string
  agreements: AgreementRow[]
  assignments: AssignmentRow[]
  members: MemberOption[]
  loading: boolean
  onRefresh: () => void
}) {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()

  const [staffOpen, setStaffOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [approving, setApproving] = useState<AgreementRow | null>(null)

  const memberOptions: SelectOption[] = useMemo(
    () =>
      members.map((m) => ({
        value: m.userId,
        label: [m.name, m.email].filter(Boolean).join(' — ') || m.userId,
      })),
    [members],
  )

  const runAgreementAction = async (id: string, action: 'end') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/agreements/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${action} agreement`)
        return
      }
      toast.success('Agreement ended')
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusyId(null)
    }
  }

  const revokeStaff = async (assignmentId: string) => {
    setBusyId(assignmentId)
    try {
      const res = await fetch(`/api/staff-assignments/${assignmentId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to revoke assignment')
        return
      }
      toast.success('Assignment revoked')
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <PageLoader title="Loading management…" description="" />

  const canPropose = hasUiPermission('agreement.create')
  const canAssign = hasUiPermission('property.update')

  return (
    <div className="space-y-4">
      <Card variant="outlined">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Handshake className="size-4" /> Management agreements
            </CardTitle>
            {canPropose ? (
              <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => router.push(`/portfolio/owners/agreements/new?propertyId=${propertyId}`)}>
                Propose agreement
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {agreements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agreements yet. Propose one to appoint a managing organization — the property
              organization approves it before it activates.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {agreements.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {a.managementOrganization?.name ?? 'Unknown manager'}
                      </p>
                      <AgreementStatusBadge status={a.status} size="sm" />
                      {a.actorIsPortfolioSide ? (
                        <Badge variant="outline" size="sm">Your organization is owner side</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">You are the manager</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[
                        a.ownerParty ? `Owner: ${a.ownerParty.name}` : null,
                        `${formatDate(a.startsAt)} → ${a.endsAt ? formatDate(a.endsAt) : 'open-ended'}`,
                        scopeNotes(a.scope) || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.status === 'DRAFT' && a.actorIsPortfolioSide && hasUiPermission('agreement.approve') ? (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={CheckCircle2}
                        disabled={busyId === a.id}
                        onClick={() => setApproving(a)}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {(a.status === 'ACTIVE' || a.status === 'SUSPENDED') && hasUiPermission('agreement.update') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={StopCircle}
                        disabled={busyId === a.id}
                        onClick={() => runAgreementAction(a.id, 'end')}
                      >
                        End
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/portfolio/owners/agreements/${a.id}/edit`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4" /> Property staff
            </CardTitle>
            {canAssign ? (
              <Button variant="outline" size="sm" leftIcon={Plus} onClick={() => setStaffOpen(true)}>
                Assign staff
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff assigned yet. Assigning a member grants them access to this property.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {assignments.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {s.user?.displayName ?? s.user?.email ?? s.user?.id ?? 'Unknown user'}
                      </p>
                      <Badge variant={s.isActive ? 'success' : 'neutral'} size="sm">
                        {s.isActive ? 'Active' : 'Revoked'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[s.title, `from ${formatDate(s.startsAt)}`, s.endsAt ? `until ${formatDate(s.endsAt)}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {s.isActive && canAssign ? (
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={XCircle}
                      disabled={busyId === s.id}
                      onClick={() => revokeStaff(s.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StaffDialog
        open={staffOpen}
        memberOptions={memberOptions}
        propertyId={propertyId}
        onClose={() => setStaffOpen(false)}
        onSaved={onRefresh}
      />

      {approving ? (
        <ApproveAgreementDialog
          key={approving.id}
          agreementId={approving.id}
          managementOrgKind={approving.managementOrganization?.kind ?? null}
          open
          onOpenChange={(o) => !o && setApproving(null)}
          onApproved={() => {
            setApproving(null)
            onRefresh()
          }}
        />
      ) : null}

      {agreements.length === 0 && !canPropose ? (
        <Text variant="bodyMuted">Only owners and managers with agreement permissions can propose contracts.</Text>
      ) : null}
    </div>
  )
}
