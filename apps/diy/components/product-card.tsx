import Link from "next/link"
import Image from "next/image"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { formatKsh } from "@/lib/money"
import type { ProductWithCategory } from "@/lib/products"
import { AddToQuoteButton } from "./add-to-quote-button"

export function ProductCard({ product }: { product: ProductWithCategory }) {
  const images = Array.isArray(product.images) ? product.images : []
  const first = images[0] as { url?: string; alt?: string } | undefined
  const imageUrl = first && typeof first.url === "string" ? first.url : null
  const imageAlt = first && typeof first.alt === "string" && first.alt ? first.alt : product.name
  const price = formatKsh(product.priceCents)
  const showUnit = Boolean(product.unit && product.unit !== "Each")

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <Link
        href={`/products/${product.category.slug}/${product.slug}`}
        className="group flex flex-1 flex-col"
      >
        <div className="relative aspect-video overflow-hidden bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground sm:text-sm">Image coming soon</p>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-6">
          <Badge variant="neutral" shape="pill" className="hidden self-start sm:inline-flex">
            {product.category.name}
          </Badge>
          <h3 className="line-clamp-2 text-sm font-semibold sm:text-lg">
            {product.name}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2 sm:text-sm">
            {product.shortDesc}
          </p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 sm:gap-3 sm:pt-2">
            <div>
              {price ? (
                <p className="text-base font-bold text-primary sm:text-xl">{price}</p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                  Price on request
                </p>
              )}
              {showUnit && (
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  per {product.unit}
                </p>
              )}
            </div>
            <span className="hidden text-sm font-medium text-primary group-hover:underline sm:inline">
              View →
            </span>
          </div>
        </CardContent>
      </Link>

      <div className="px-3 pb-3 sm:px-6 sm:pb-6">
        <AddToQuoteButton product={product} />
      </div>
    </Card>
  )
}
