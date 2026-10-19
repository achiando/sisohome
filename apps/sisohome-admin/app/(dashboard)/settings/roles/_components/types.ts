export interface Role {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  isTemplate: boolean
  /** Staff role: the holder may belong to only one organization. */
  singleOrg: boolean
  /** Granted permission keys (read-only view of the role's matrix). */
  permissions: string[]
  memberCount: number
}

export interface PermissionInfo {
  id: string
  key: string
  name: string
  description: string | null
  scope: string
}

export type RoleType = 'SYSTEM' | 'TEMPLATE' | 'CUSTOM'

export function roleType(role: Pick<Role, 'isSystem' | 'isTemplate'>): RoleType {
  if (role.isSystem) return 'SYSTEM'
  if (role.isTemplate) return 'TEMPLATE'
  return 'CUSTOM'
}

export function roleTypeLabel(role: Pick<Role, 'isSystem' | 'isTemplate'>): string {
  return roleType(role).charAt(0) + roleType(role).slice(1).toLowerCase()
}

export function roleTypeVariant(
  role: Pick<Role, 'isSystem' | 'isTemplate'>,
): 'primary' | 'info' | 'neutral' {
  switch (roleType(role)) {
    case 'SYSTEM':
      return 'primary'
    case 'TEMPLATE':
      return 'info'
    default:
      return 'neutral'
  }
}

/** Friendly labels for permission-key prefixes (resource groups in the matrix). */
const GROUP_LABELS: Record<string, string> = {
  organization: 'Organization',
  user: 'Users',
  membership: 'Members',
  role: 'Roles',
  permission: 'Permissions',
  relationship: 'Relationships',
  resource: 'Resources',
  audit: 'Audit',
  platform: 'Platform',
  property: 'Properties',
  lease: 'Leases',
  tenant: 'Tenants',
}

const GROUP_ORDER = [
  'organization',
  'user',
  'membership',
  'role',
  'permission',
  'relationship',
  'resource',
  'audit',
  'platform',
  'property',
  'lease',
  'tenant',
]

export interface PermissionGroup {
  prefix: string
  label: string
  keys: string[]
}

/** Group permission keys by their resource prefix, in a stable display order. */
export function groupPermissionKeys(keys: string[]): PermissionGroup[] {
  const map = new Map<string, string[]>()
  for (const key of keys) {
    const prefix = key.split('.')[0] ?? key
    const list = map.get(prefix)
    if (list) list.push(key)
    else map.set(prefix, [key])
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      const ia = GROUP_ORDER.indexOf(a)
      const ib = GROUP_ORDER.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(([prefix, groupKeys]) => ({
      prefix,
      label:
        GROUP_LABELS[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1),
      keys: [...groupKeys].sort((a, b) => a.localeCompare(b)),
    }))
}
