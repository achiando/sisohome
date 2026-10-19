'use client'

import { Building2 } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@workspace/ui/components/item'
import { Text } from '@workspace/ui/components/text'

export interface WorkspaceMembership {
  organizationId: string
  organization?: { name?: string; kind?: string }
}

interface WorkspaceListProps {
  memberships: WorkspaceMembership[]
  joiningId: string | null
  onJoin: (organizationId: string) => void
}

/** Join an existing workspace — one row per membership (Item suite). */
export function WorkspaceList({ memberships, joiningId, onJoin }: WorkspaceListProps) {
  return (
    <section>
      <Text variant="headline" as="h1">
        Choose a workspace
      </Text>
      <Text variant="bodyMuted" className="mt-1">
        You belong to {memberships.length} organization{memberships.length > 1 ? 's' : ''}.
        Select the one you want to work in — you can switch anytime from the sidebar.
      </Text>

      <ItemGroup className="mt-4">
        {memberships.map((m) => {
          const id = m.organizationId
          const name = m.organization?.name ?? 'Organization'
          return (
            <Item key={id} variant="outline" className="rounded-xl">
              <ItemMedia className="size-10 rounded-xl bg-accent text-accent-foreground">
                <Building2 className="size-5" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{name}</ItemTitle>
                <ItemDescription className="capitalize">
                  {(m.organization?.kind ?? '').toLowerCase().replace(/_/g, ' ')}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="md"
                  loading={joiningId === id}
                  onClick={() => onJoin(id)}
                  aria-label={`Join ${name}`}
                >
                  Join
                </Button>
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
    </section>
  )
}
