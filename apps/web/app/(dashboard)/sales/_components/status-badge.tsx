import { Badge } from '@workspace/ui/components/badge'

const LISTING_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  PAUSED: 'warning',
  UNDER_OFFER: 'warning',
  SOLD: 'default',
  RENTED: 'default',
  WITHDRAWN: 'error',
  EXPIRED: 'neutral',
}

const LEAD_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'neutral'> = {
  NEW: 'success',
  QUALIFIED: 'neutral',
  MATCHED: 'neutral',
  VIEWING: 'warning',
  OFFERING: 'warning',
  WON: 'default',
  LOST: 'error',
  WITHDRAWN: 'neutral',
}

const GENERIC_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'neutral'> = {
  SCHEDULED: 'warning',
  COMPLETED: 'success',
  NO_SHOW: 'error',
  CANCELLED: 'neutral',
  SUBMITTED: 'warning',
  COUNTERED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'neutral',
  EXPIRED: 'neutral',
  OFFERED: 'warning',
  DECLINED: 'error',
  AGREED: 'success',
  DUE_DILIGENCE: 'warning',
  COMPLETION_PENDING: 'warning',
  COLLAPSED: 'error',
}

export function labelize(value: string): string {
  return value
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

export function ListingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={LISTING_TONE[status] ?? 'neutral'} dot>
      {labelize(status)}
    </Badge>
  )
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={LEAD_TONE[status] ?? 'neutral'} dot>
      {labelize(status)}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={GENERIC_TONE[status] ?? 'neutral'} dot>
      {labelize(status)}
    </Badge>
  )
}

export function AccessBadge({ access }: { access: 'owner' | 'shared' }) {
  return (
    <Badge variant={access === 'shared' ? 'warning' : 'neutral'} shape="pill">
      {access === 'shared' ? 'Shared with me' : 'Mine'}
    </Badge>
  )
}
