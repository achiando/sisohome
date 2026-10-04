"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
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
import { ProductCard } from "@/components/product-card"
import { ProjectCard } from "@/components/project-card"

interface ProductClientProps {
  product: ProductWithCategory
  relatedProducts: ProductWithCategory[]
  relatedProjects: ProjectListItem[]
  projectsTitle: string
}

export function ProductClient({
  product,
  relatedProducts,
  relatedProjects,
  projectsTitle,
}: ProductClientProps) {
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
      priceCents: product.priceCents,
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

  const scrollRow =
    "flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-none sm:gap-4"
  const scrollItem = "w-[68%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[23%]"

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12">
        {/* Product image gallery */}
        <div>
          {images.length > 0 && images[selectedImage] ? (
            <>
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={images[selectedImage].url}
                  alt={images[selectedImage].alt || product.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  priority
                />
                {images.length > 1 && (
                  <span
                    className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
                    aria-hidden="true"
                  >
                    {selectedImage + 1} / {images.length}
                  </span>
                )}
              </div>
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {images.map((img, i) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setSelectedImage(i)}
                      aria-label={`Show image ${i + 1} of ${product.name}`}
                      aria-pressed={selectedImage === i}
                      className={`relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-muted transition-all sm:h-20 sm:w-20 ${
                        selectedImage === i
                          ? "ring-2 ring-primary"
                          : "hover:ring-2 hover:ring-primary/60"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt || product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted">
              <p className="text-muted-foreground">Product image coming soon</p>
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <div className="mb-3">
            <Link
              href={`/products/${product.category.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {product.category.name}
            </Link>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {product.name}
          </h1>
          <p className="mb-6 text-base text-muted-foreground sm:text-lg">
            {product.shortDesc}
          </p>

          {price ? (
            <div className="mb-6">
              <p className="text-2xl font-bold text-primary sm:text-3xl">
                {price}
              </p>
              <p className="text-sm text-muted-foreground">
                Final pricing is confirmed in your quotation
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-xl font-bold text-muted-foreground sm:text-2xl">
                Price on request
              </p>
            </div>
          )}

          <Card>
            <CardContent className="p-4 sm:p-6">
              {product.unit && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Sold per{" "}
                  <span className="font-medium text-foreground">
                    {product.unit}
                  </span>
                </p>
              )}

              <div
                className="mb-4 flex items-center gap-3"
                role="group"
                aria-label="Quantity"
              >
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center rounded-xl border">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="h-11 px-3 transition-colors hover:bg-muted disabled:opacity-40"
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
                    className="h-11 px-3 transition-colors hover:bg-muted"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToQuote}
                className="w-full"
              >
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
        </div>
      </div>

      {/* Overview */}
      {product.description && (
        <section className="mt-10 lg:mt-14">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl md:text-3xl">
            Overview
          </h2>
          <p className="max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </section>
      )}

      {/* Specifications */}
      {specifications.length > 0 && (
        <section className="mt-10 lg:mt-14">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl md:text-3xl">
            Specifications
          </h2>
          <dl className="max-w-3xl divide-y rounded-2xl border bg-card">
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

      {/* Related products — horizontal scroll */}
      {relatedProducts.length > 0 && (
        <section className="mt-10 lg:mt-14" aria-label="Related products">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold sm:text-2xl md:text-3xl">
              Related Products
            </h2>
            <Link
              href={`/products/${product.category.slug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              More in {product.category.name} →
            </Link>
          </div>
          <div className={scrollRow}>
            {relatedProducts.map((related) => (
              <div key={related.id} className={scrollItem}>
                <ProductCard product={related} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related projects — horizontal scroll */}
      {relatedProjects.length > 0 && (
        <section className="mt-10 lg:mt-14" aria-label="Related projects">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold sm:text-2xl md:text-3xl">
              {projectsTitle}
            </h2>
            <Link
              href="/projects"
              className="text-sm font-medium text-primary hover:underline"
            >
              All projects →
            </Link>
          </div>
          <div className={scrollRow}>
            {relatedProjects.map((project) => (
              <div
                key={project.id}
                className="w-[78%] shrink-0 snap-start sm:w-[48%] md:w-[32%] lg:w-[24%]"
              >
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WhatsApp CTA */}
      <section className="mt-10 rounded-2xl bg-muted/50 p-6 text-center lg:mt-14 sm:p-8">
        <h2 className="mb-4 text-xl font-bold sm:text-2xl md:text-3xl">
          Request a Quotation
        </h2>
        <p className="mb-6 text-muted-foreground">
          Add this product to your quote — or message us directly if you have a
          question first
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
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
