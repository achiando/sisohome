import Link from "next/link"
import Image from "next/image"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ProductWithCategory } from "@/lib/products"

interface ProductCardProps {
  product: ProductWithCategory
}

export function ProductCard({ product }: ProductCardProps) {
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
        className="group block h-full"
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

        <CardContent className="flex flex-col gap-2 p-6">
          <Badge variant="neutral" shape="pill" className="self-start">
            {product.category.name}
          </Badge>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">{product.shortDesc}</p>
          <span className="mt-2 text-sm font-medium text-primary">
            View design →
          </span>
        </CardContent>
      </Link>
    </Card>
  )
}
