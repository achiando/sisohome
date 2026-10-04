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
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Image coming soon</p>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-2 p-6">
          <Badge variant="neutral" shape="pill" className="self-start">
            {product.category.name}
          </Badge>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{product.shortDesc}</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <div>
              {price ? (
                <p className="text-xl font-bold text-primary">{price}</p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">
                  Price on request
                </p>
              )}
              {showUnit && (
                <p className="text-xs text-muted-foreground">per {product.unit}</p>
              )}
            </div>
            <span className="text-sm font-medium text-primary group-hover:underline">
              View →
            </span>
          </div>
        </CardContent>
      </Link>

      <div className="px-6 pb-6">
        <AddToQuoteButton product={product} />
      </div>
    </Card>
  )
}
