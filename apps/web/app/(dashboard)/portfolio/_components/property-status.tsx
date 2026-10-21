'use client'

/** Shared status chip for property rows (index + detail header). */

import { Badge } from '@workspace/ui/components/badge'

export function PropertyStatusBadge({
  status,
  size = 'sm',
}: {
  status: string
  size?: 'sm' | 'md'
}) {
  const variant =
    status === 'ACTIVE'
      ? 'success'
      : status === 'DRAFT'
        ? 'warning'
        : status === 'ARCHIVED'
          ? 'outline'
          : 'neutral'
  const label =
    status === 'INACTIVE' ? 'Inactive' : status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <Badge variant={variant} size={size} dot>
      {label}
    </Badge>
  )
}

export function humanizeAction(action: string): string {
  const labels: Record<string, string> = {
    'property.create': 'Property created',
    'property.update': 'Property updated',
    'property.archive': 'Property archived',
    'property.unarchive': 'Property unarchived',
    'property.delete': 'Property deleted',
  }
  if (labels[action]) return labels[action]
  return action
    .split(/[._-]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}
