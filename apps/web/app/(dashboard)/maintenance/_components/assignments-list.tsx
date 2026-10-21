'use client'

/**
 * AssignmentsList — work-order assignment rows with Decline / Complete
 * (assignee side, plan-slice-3 §3). Status moves fire
 * PATCH /api/work-order-assignments/[id].
 */

import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'

export interface AssignmentRow {
  id: string
  status: string
  assignedAt: string
  completedAt: string | null
  assigneeUser: { id: string; displayName: string; email?: string | null }
  assigneeOrganization: { id: string; name: string } | null
}

export function AssignmentsList({
  assignments,
  canUpdate,
  onChanged,
}: {
  assignments: AssignmentRow[]
  canUpdate: boolean
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const move = async (id: string, status: 'DECLINED' | 'COMPLETED') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/work-order-assignments/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      toast.success(status === 'COMPLETED' ? 'Assignment completed' : 'Assignment declined')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>Assignments</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {assignments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nobody assigned yet.</p>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.assigneeUser.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {a.assigneeOrganization ? `${a.assigneeOrganization.name} · ` : ''}
                  assigned {formatDate(a.assignedAt)}
                  {a.completedAt ? ` · finished ${formatDate(a.completedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm">
                  {a.status.toLowerCase()}
                </Badge>
                {canUpdate && a.status === 'ASSIGNED' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === a.id}
                      onClick={() => move(a.id, 'DECLINED')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busyId === a.id}
                      disabled={busyId === a.id}
                      onClick={() => move(a.id, 'COMPLETED')}
                    >
                      Complete
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
