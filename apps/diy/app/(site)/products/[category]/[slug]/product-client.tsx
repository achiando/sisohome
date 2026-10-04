"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  addToQuoteBasket,
  getQuoteBasketCount,
  getWhatsAppBaseLink,
  type QuoteItem,
} from "@/lib/quote-basket"
import type { ProductWithCategory } from "@/lib/products"
import type { ProjectListItem } from "@/lib/projects"
import { formatKsh } from "@/lib/money"
import { parseSpecifications } from "@/lib/specifications"

interface ProductClientProps {
  product: ProductWithCategory
  relatedProducts: ProductWithCategory[]
  relatedProjects: ProjectListItem[]
}

export function ProductClient({ product, relatedProducts, relatedProjects }: ProductClientProps) {
  const [addedToQuote, setAddedToQuote] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const price = formatKsh(product.priceCents)

  const handleAddToQuote = () => {
    const quoteItem: QuoteItem = {
      id: product.id,
      name: product.name,
      categorySlug: product.category.slug,
      slug: product.slug,
      quantity,
      unit: product.unit,
      price: formatKsh(product.priceCents),
      sourceProject: null,
    }

    addToQuoteBasket(quoteItem)
    setQuoteCount(getQuoteBasketCount())
    setAddedToQuote(true)
    setTimeout(() => setAddedToQuote(false), 3000)
  }

  const specifications = parseSpecifications(product.specifications)
  const images = Array.isArray(product.images)
    ? (product.images as { url: string; alt?: string }[]).filter(
        (image): image is { url: string; alt?: string } =>
          Boolean(image) && typeof image.url === "string",
      )
    : []

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product image */}
        <div>
          {images.length > 0 && images[selectedImage] ? (
            <>
              <div className="aspect-square bg-muted rounded-2xl mb-4 overflow-hidden relative">
                <Image
                  src={images[selectedImage].url}
                  alt={images[selectedImage].alt || product.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.slice(0, 8).map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedImage(i)}
                      aria-label={`Show image ${i + 1}`}
                      aria-pressed={selectedImage === i}
                      className={`aspect-square bg-muted rounded-xl cursor-pointer overflow-hidden relative hover:ring-2 ring-primary ${
                        selectedImage === i ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt || `${product.name} thumbnail ${i + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center">
              <p className="text-muted-foreground">Product image coming soon</p>
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <div className="mb-4">
            <Link
              href={`/products/${product.category.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {product.category.name}
            </Link>
          </div>

          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-xl text-muted-foreground mb-6">{product.shortDesc}</p>

          {price ? (
            <div className="mb-6">
              <p className="text-3xl font-bold text-primary">{price}</p>
              <p className="text-sm text-muted-foreground">
                Final pricing is confirmed in your quotation
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-2xl font-bold text-muted-foreground">
                Price on request
              </p>
            </div>
          )}

          <Card className="mb-8">
            <CardContent className="p-6">
              {product.unit && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Sold per <span className="font-medium text-foreground">{product.unit}</span>
                </p>
              )}

              <div
                className="mb-4 flex items-center gap-3"
                role="group"
                aria-label="Quantity"
              >
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center border rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="px-3 h-11 hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span
                    className="w-12 text-center text-sm font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Increase quantity"
                    className="px-3 h-11 hover:bg-muted transition-colors"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <Button variant="primary" size="lg" onClick={handleAddToQuote} className="w-full">
                {addedToQuote ? `Added to Quote ✓ (${quoteCount})` : "Add to Quote"}
              </Button>

              <p className="mt-3 text-center text-sm text-muted-foreground">
                No payment now — your quote is sent to us for confirmation.
              </p>

              {addedToQuote && (
                <Link href="/quote" className="mt-4 block">
                  <Button variant="outline" size="md" className="w-full">
                    View Quote →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Separator className="my-8" />

          {product.description && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Overview</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </section>
          )}

          {specifications.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Specifications</h2>
              <dl className="divide-y rounded-2xl border bg-card">
                {specifications.map((spec) => (
                  <div
                    key={`${spec.label}-${spec.material}`}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <dt className="text-sm text-muted-foreground">{spec.label}</dt>
                    <dd className="flex items-center gap-2 text-sm font-medium text-right">
                      {spec.material}
                      {spec.pieces !== null && (
                        <Badge variant="neutral" shape="pill">
                          {spec.pieces} {spec.pieces === 1 ? "piece" : "pieces"}
                        </Badge>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {relatedProjects.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Projects Using This Product</h2>
              <div className="grid grid-cols-1 gap-3">
                {relatedProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.slug}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <h3 className="font-semibold text-sm">{project.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {project.shortDesc}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-primary shrink-0">
                          View →
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {relatedProducts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Related Products</h2>
              <div className="grid grid-cols-2 gap-4">
                {relatedProducts.slice(0, 4).map((related) => (
                  <Link
                    key={related.id}
                    href={`/products/${related.category.slug}/${related.slug}`}
                  >
                    <Card className="hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm">{related.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {related.shortDesc}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* WhatsApp CTA */}
      <section className="mt-12 bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Request a Quotation</h2>
        <p className="text-muted-foreground mb-6">
          Add this product to your quote — or message us directly if you have a
          question first
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/quote">
            <Button variant="primary" size="lg">Review Your Quote</Button>
          </Link>
          <a href={getWhatsAppBaseLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="lg">Ask on WhatsApp</Button>
          </a>
        </div>
      </section>
    </div>
  )
}
