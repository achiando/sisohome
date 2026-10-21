'use client'

/**
 * Controlled detail-page tabs with `?tab=` URL sync and lazy panels.
 *
 * - Deep links: `/portfolio/abc?tab=units` opens the Units tab; invalid or
 *   missing `tab` params fall back to `tabs[0]`.
 * - URL sync uses `useSearchParams` — pages rendering this component must
 *   wrap it in `<Suspense>` (Next App Router CSR-bailout requirement).
 * - Panels are lazy: Radix unmounts inactive `TabsContent` (no `forceMount`),
 *   so a tab's data fetching only runs when first opened.
 */

import { Suspense, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@workspace/ui/components/tabs'

export interface DetailTab {
  id: string
  label: string
  /** Optional numeric count pill shown after the label. */
  count?: number
  /** Panel content — mounted only while the tab is active. */
  content: ReactNode
}

export interface DetailTabsProps {
  tabs: DetailTab[]
  /** Tab id to show when the URL carries no (or an invalid) `?tab=`. */
  defaultTab?: string
  /** Fires on every tab change (after validation) — e.g. refetch hooks. */
  onTabChange?: (id: string) => void
}

function DetailTabsInner({ tabs, defaultTab, onTabChange }: DetailTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL is the single source of truth (no local state → no effect sync):
  // prefer a valid `?tab=`, else default, else first tab.
  const urlTab = searchParams.get('tab')
  const active =
    urlTab && tabs.some((t) => t.id === urlTab)
      ? urlTab
      : defaultTab && tabs.some((t) => t.id === defaultTab)
        ? defaultTab
        : (tabs[0]?.id ?? '')

  const handleChange = useCallback(
    (id: string) => {
      if (!tabs.some((t) => t.id === id)) return
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      onTabChange?.(id)
    },
    [tabs, searchParams, router, pathname, onTabChange],
  )

  if (tabs.length === 0) return null

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList variant="line" size="md">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} count={tab.count}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function DetailTabs(props: DetailTabsProps) {
  return (
    <Suspense fallback={null}>
      <DetailTabsInner {...props} />
    </Suspense>
  )
}
