'use client'

/**
 * Read-only permission matrix for one role (BUILD.md: permission matrix
 * grouped by resource — checkbox groups, disabled for editing while roles
 * are seeded per organization kind). Shows the full catalog so owners can
 * compare what a role grants vs. lacks; checked = granted.
 */

import { useMemo } from 'react'

import { Badge } from '@workspace/ui/components/badge'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Text } from '@workspace/ui/components/text'
import {
  groupPermissionKeys,
  roleTypeLabel,
  roleTypeVariant,
  type PermissionInfo,
  type Role,
} from './types'

interface RolePermissionsDialogProps {
  role: Role | null
  permissions: PermissionInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RolePermissionsDialog({
  role,
  permissions,
  open,
  onOpenChange,
}: RolePermissionsDialogProps) {
  const granted = useMemo(() => new Set(role?.permissions ?? []), [role])
  const byKey = useMemo(
    () => new Map(permissions.map((p) => [p.key, p])),
    [permissions],
  )
  const groups = useMemo(
    () => groupPermissionKeys(permissions.map((p) => p.key)),
    [permissions],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role?.name ?? 'Role'}</DialogTitle>
          <DialogDescription>
            {role?.description ?? 'Permissions granted to this role.'} Roles are seeded from
            your organization kind and are read-only for now.
          </DialogDescription>
        </DialogHeader>

        {role && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={roleTypeVariant(role)} size="sm">
                {roleTypeLabel(role)}
              </Badge>
              <Badge variant="outline" size="sm">
                {granted.size} of {permissions.length} permissions
              </Badge>
              {role.singleOrg && (
                <Badge variant="warning" size="sm">
                  One org
                </Badge>
              )}
            </div>

            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.prefix}>
                  <Text variant="label" as="h4">
                    {group.label}
                  </Text>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <Checkbox
                        key={key}
                        checked={granted.has(key)}
                        disabled
                        label={byKey.get(key)?.name ?? key}
                        description={key}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
