import Link from "next/link"
import Image from "next/image"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ProductWithCategory } from "@/lib/products"

interface ProductCardProps {
  product: ProductWithCategory
  showCategory?: boolean
}

export function ProductCard({ product, showCategory = true }: ProductCardProps) {
  const firstImage =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : null
  const imageUrl =
    firstImage && typeof firstImage === "object" && typeof firstImage.url === "string"
      ? firstImage.url
      : null
  const imageAlt =
    firstImage && typeof firstImage === "object" && typeof firstImage.alt === "string"
      ? firstImage.alt
      : product.name

  return (
    <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
      <Link
        href={`/products/${product.category.slug}/${product.slug}`}
        className="group flex h-full flex-col"
      >
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-muted md:h-56">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Image coming soon</p>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-2 p-6">
          {showCategory && (
            <Badge variant="neutral" shape="pill" className="self-start">
              {product.category.name}
            </Badge>
          )}
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.priceRange && (
            <p className="text-sm font-semibold text-primary">{product.priceRange}</p>
          )}
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {product.shortDesc}
          </p>
          <span className="mt-auto pt-2 text-sm font-medium text-primary">
            View design →
          </span>
        </CardContent>
      </Link>
    </Card>
  )
}
