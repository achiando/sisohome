"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { CategoryList } from "@/lib/products"

interface CategoryChipsProps {
  categories: CategoryList[]
  counts: Record<string, number>
  activeSlug?: string
  className?: string
  onDark?: boolean
}

const SCROLL_STEP = 280

export function CategoryChips({
  categories,
  counts,
  activeSlug,
  className = "mb-10",
  onDark,
}: CategoryChipsProps) {
  const scrollRef = useRef<HTMLElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const updateEdgeState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
    setOverflowing(el.scrollWidth > el.clientWidth + 4)
  }, [])

  useEffect(() => {
    updateEdgeState()
    window.addEventListener("resize", updateEdgeState)
    return () => window.removeEventListener("resize", updateEdgeState)
  }, [updateEdgeState, categories.length])

  const scroll = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: "smooth" })
  }

  if (categories.length === 0) return null

  const chipClass = (selected: boolean) =>
    cn(
      "cursor-pointer transition hover:opacity-85 active:scale-[0.98]",
      onDark &&
        !selected &&
        "border-white/25 bg-white/10 text-white hover:bg-white/20",
    )

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {overflowing && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll categories left"
          disabled={atStart}
          onClick={() => scroll(-1)}
          className="hidden shrink-0 rounded-full md:inline-flex"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <nav
        ref={scrollRef}
        aria-label="Product categories"
        onScroll={updateEdgeState}
        className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto"
      >
        <Link href="/products" className="shrink-0">
          <Badge
            variant="neutral"
            size="lg"
            shape="pill"
            className={chipClass(!activeSlug)}
            selected={!activeSlug}
          >
            All
          </Badge>
        </Link>

        {categories.map((category) => {
          const selected = activeSlug === category.slug
          return (
            <Link
              key={category.id}
              href={`/products/${category.slug}`}
              className="shrink-0"
            >
              <Badge
                variant="neutral"
                size="lg"
                shape="pill"
                className={chipClass(selected)}
                selected={selected}
              >
                {category.name}
                <span className="ml-1.5 text-xs opacity-70">
                  {counts[category.slug] ?? 0}
                </span>
              </Badge>
            </Link>
          )
        })}
      </nav>

      {overflowing && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll categories right"
          disabled={atEnd}
          onClick={() => scroll(1)}
          className="hidden shrink-0 rounded-full md:inline-flex"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
