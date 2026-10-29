'use client'

/**
 * DealChecklist — the deal-room checklist (category-ordered, soft-gated).
 * Each toggle PATCHes the deal server-side (marks done + who + when).
 */

import { useState } from 'react'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Badge } from '@workspace/ui/components/badge'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import type { DealChecklistItem } from './sales-types'
import { labelize } from './status-badge'

export interface DealChecklistProps {
  dealId: string
  items: DealChecklistItem[]
  disabled?: boolean
  onChanged?: () => void
}

export function DealChecklist({ dealId, items, disabled = false, onChanged }: DealChecklistProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const toggle = async (item: DealChecklistItem, done: boolean) => {
    setBusyKey(item.key)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: [{ key: item.key, done }] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not update the checklist')
        return
      }
      toast.success(done ? `${item.label} — done` : `${item.label} — reopened`)
      onChanged?.()
    } catch {
      toast.error('Network error — checklist not saved')
    } finally {
      setBusyKey(null)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No checklist items on this deal yet.</p>
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-2 hover:border-border hover:bg-muted/30"
        >
          <Checkbox
            checked={item.done}
            disabled={disabled || busyKey === item.key}
            onCheckedChange={(v) => toggle(item, v === true)}
            aria-label={item.label}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={item.done ? 'text-sm line-through text-muted-foreground' : 'text-sm font-medium'}>
                {item.label}
              </span>
              {item.mandatory ? (
                <Badge variant="neutral" size="sm">
                  Required
                </Badge>
              ) : null}
              {item.done && item.doneAt ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(item.doneAt)}
                </span>
              ) : null}
            </div>
            {!item.done && item.mandatory ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Required before completion — {labelize(item.key)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
