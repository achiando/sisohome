export interface MemberRole {
  id: string
  name: string
  slug: string
}

export interface Member {
  membershipId: string
  userId: string
  email: string
  name: string | null
  status: string
  roles: MemberRole[]
  joinedAt: string
}

export interface Role {
  id: string
  name: string
  slug: string
  isTemplate: boolean
  /** Staff role: the person can belong to only one organization. */
  singleOrg: boolean
}

/** Show a work-email hint based on the org domain. */
export function emailDomainHint(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at) : null
}

export function statusVariant(status: string): 'success' | 'warning' | 'neutral' {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'success'
    case 'SUSPENDED':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function statusLabel(status: string): string {
  const s = status.toUpperCase()
  if (s === 'ACTIVE') return 'Active'
  if (s === 'SUSPENDED') return 'Suspended'
  if (s === 'REMOVED') return 'Removed'
  return s
}
