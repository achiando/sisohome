import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { CategoryList } from "@/lib/products"

interface CategoryChipsProps {
  categories: CategoryList[]
  counts: Record<string, number>
  activeSlug?: string
  className?: string
  onDark?: boolean
}

export function CategoryChips({
  categories,
  counts,
  activeSlug,
  className = "mb-10",
  onDark,
}: CategoryChipsProps) {
  if (categories.length === 0) return null

  const chipClass = (selected: boolean) =>
    cn(
      "cursor-pointer transition hover:opacity-85 active:scale-[0.98]",
      onDark &&
        !selected &&
        "border-white/25 bg-white/10 text-white hover:bg-white/20",
    )

  return (
    <nav
      aria-label="Product categories"
      className={cn("flex flex-wrap gap-2", className)}
    >
      <Link href="/products">
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
          <Link key={category.id} href={`/products/${category.slug}`}>
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
  )
}
