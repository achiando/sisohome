import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import type { CategoryList } from "@/lib/products"

interface CategoryChipsProps {
  categories: CategoryList[]
  counts: Record<string, number>
  activeSlug?: string
}

export function CategoryChips({ categories, counts, activeSlug }: CategoryChipsProps) {
  if (categories.length === 0) return null

  return (
    <nav aria-label="Product categories" className="mb-10 flex flex-wrap gap-2">
      <Link href="/products">
        <Badge
          variant="neutral"
          size="lg"
          shape="pill"
          className="cursor-pointer transition hover:opacity-85 active:scale-[0.98]"
          selected={!activeSlug}
        >
          All
        </Badge>
      </Link>

      {categories.map((category) => (
        <Link key={category.id} href={`/products/${category.slug}`}>
          <Badge
            variant="neutral"
            size="lg"
            shape="pill"
            className="cursor-pointer transition hover:opacity-85 active:scale-[0.98]"
            selected={activeSlug === category.slug}
          >
            {category.name}
            <span className="ml-1.5 text-xs opacity-70">
              {counts[category.slug] ?? 0}
            </span>
          </Badge>
        </Link>
      ))}
    </nav>
  )
}
