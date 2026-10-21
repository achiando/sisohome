'use client'

/**
 * Vertical section nav for detail pages (siso-design portfolio-property
 * mockup): sticky left rail on lg+, horizontal chip row on smaller screens.
 * Same URL contract as DetailTabs — `?tab=` is the single source of truth
 * (deep links; invalid/missing fall back to `defaultTab`), so pages must not
 * need extra sync effects. Panels are lazy (unmounted while inactive).
 */

import { Suspense, useCallback, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@workspace/ui/lib/utils'

export interface DetailSection {
  id: string
  label: string
  /** Panel content — mounted only while the section is active. */
  content: ReactNode
}

export interface SectionNavProps {
  sections: DetailSection[]
  /** Section id to show when the URL carries no (or an invalid) `?tab=`. */
  defaultTab?: string
}

function SectionNavInner({ sections, defaultTab }: SectionNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlTab = searchParams.get('tab')
  const active =
    urlTab && sections.some((s) => s.id === urlTab)
      ? urlTab
      : defaultTab && sections.some((s) => s.id === defaultTab)
        ? defaultTab
        : (sections[0]?.id ?? '')

  const handleSelect = useCallback(
    (id: string) => {
      if (!sections.some((s) => s.id === id)) return
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [sections, searchParams, router, pathname],
  )

  if (sections.length === 0) return null

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Sections" className="lg:sticky lg:top-6">
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => handleSelect(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-10 w-full items-center rounded-xl px-3 text-left text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'border border-border bg-background text-foreground shadow-xs'
                      : 'border border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  {section.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        {sections.map((section) =>
          section.id === active ? <div key={section.id}>{section.content}</div> : null,
        )}
      </div>
    </div>
  )
}

export function SectionNav(props: SectionNavProps) {
  return (
    <Suspense fallback={null}>
      <SectionNavInner {...props} />
    </Suspense>
  )
}
