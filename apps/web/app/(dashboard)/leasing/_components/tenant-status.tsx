'use client'

/** Status badges for the tenant directory + profile. */

import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import { TENANT_PORTAL_STATUS_VALUES, TENANT_STATUS_VALUES } from '@/lib/domain/tenant-constants'

type TenantStatusValue = (typeof TENANT_STATUS_VALUES)[number]
type PortalStatusValue = (typeof TENANT_PORTAL_STATUS_VALUES)[number]

const STATUS_TONE: Record<TenantStatusValue, string> = {
  PROSPECT: 'bg-muted text-muted-foreground',
  APPLICANT: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  PAST: 'bg-muted text-muted-foreground',
}

const PORTAL_TONE: Record<PortalStatusValue, string> = {
  NOT_INVITED: 'bg-muted text-muted-foreground',
  INVITED: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  SUSPENDED: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

const STATUS_LABEL: Record<TenantStatusValue, string> = {
  PROSPECT: 'Prospect',
  APPLICANT: 'Applicant',
  ACTIVE: 'Active',
  PAST: 'Past',
}

const PORTAL_LABEL: Record<PortalStatusValue, string> = {
  NOT_INVITED: 'Not invited',
  INVITED: 'Invited',
  ACTIVE: 'Portal active',
  SUSPENDED: 'Suspended',
}

export function TenantStatusBadge({ status }: { status: string }) {
  const key = (TENANT_STATUS_VALUES as readonly string[]).includes(status)
    ? (status as TenantStatusValue)
    : 'PROSPECT'
  return (
    <Badge variant="neutral" size="sm" className={cn('font-medium', STATUS_TONE[key])}>
      {STATUS_LABEL[key]}
    </Badge>
  )
}

export function TenantPortalBadge({ status }: { status: string }) {
  const key = (TENANT_PORTAL_STATUS_VALUES as readonly string[]).includes(status)
    ? (status as PortalStatusValue)
    : 'NOT_INVITED'
  return (
    <Badge variant="neutral" size="sm" className={cn('font-medium', PORTAL_TONE[key])}>
      {PORTAL_LABEL[key]}
    </Badge>
  )
}
