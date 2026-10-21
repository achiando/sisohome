'use client'

/**
 * Shared page header for dashboard routes — title + description + an
 * optional gated action slot (workspace-ui typography: Text variants, never
 * raw h1/gray classes).
 *
 * Gate actions at the CALL SITE with `hasUiPermission` before handing them
 * here — this component renders what it's given (server routes remain the
 * real authorization gate).
 */

import type { ReactNode } from 'react'
import { Text } from '@workspace/ui/components/text'

export interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons/badges rendered right-aligned on sm+ (stacks below on mobile). */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Text variant="headline" as="h1">
          {title}
        </Text>
        {description ? (
          <Text variant="bodyMuted" className="mt-1">
            {description}
          </Text>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
