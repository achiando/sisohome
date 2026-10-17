'use client'

/**
 * Overflow menu for a member row: Edit, Suspend/Reactivate, Remove.
 * Gate is a UX convenience — membership.manage is enforced server-side.
 * Uses the design-system DropdownMenu (portals to body — never clipped by
 * the table's scroll container).
 */

import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { MoreHorizontal, Pencil, UserCheck, UserX, Trash2 } from 'lucide-react'
import type { Member } from './types'

export type MemberAction = 'edit' | 'suspend' | 'reactivate' | 'remove'

export function MemberRowActions({
  member,
  onSelect,
}: {
  member: Member
  onSelect: (action: MemberAction, member: Member) => void
}) {
  const { hasUiPermission } = useUiPermission()

  if (!hasUiPermission('membership.manage')) return null

  const items: Array<{
    label: string
    icon: typeof Pencil
    action: MemberAction
    destructive?: boolean
  }> = [
    { label: 'Edit', icon: Pencil, action: 'edit' },
    ...(member.status === 'ACTIVE'
      ? [{ label: 'Suspend', icon: UserX, action: 'suspend' as const }]
      : [{ label: 'Reactivate', icon: UserCheck, action: 'reactivate' as const }]),
    ...(member.status !== 'REMOVED'
      ? [
          {
            label: 'Remove',
            icon: Trash2,
            action: 'remove' as const,
            destructive: true,
          },
        ]
      : []),
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          aria-label="Member actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 min-w-0">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.action}
            variant={item.destructive ? 'destructive' : 'default'}
            onSelect={() => onSelect(item.action, member)}
          >
            <item.icon className="size-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
