"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Separator } from "@workspace/ui/components/separator"
import { 
  addToQuoteBasket, 
  getQuoteBasketCount,
  type QuoteItem 
} from "@/lib/quote-basket"
import type { ProductWithCategory } from "@/lib/products"
import { parseSpecifications } from "@/lib/specifications"

interface ProductClientProps {
  product: ProductWithCategory
  relatedProducts: ProductWithCategory[]
}

export function ProductClient({ product, relatedProducts }: ProductClientProps) {
  const [addedToQuote, setAddedToQuote] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)
  const [selectedImage, setSelectedImage] = useState(0)

  const handleAddToQuote = () => {
    const quoteItem: QuoteItem = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      quantity: 1,
      price: product.priceRange || "Request Quote"
    }
    
    addToQuoteBasket(quoteItem)
    setAddedToQuote(true)
    setQuoteCount(getQuoteBasketCount())
    
    setTimeout(() => setAddedToQuote(false), 3000)
  }

  const specifications = parseSpecifications(product.specifications)
  const images = product.images as Array<{ url: string; alt?: string }> || []

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-foreground">Products</Link>
        <span className="mx-2">/</span>
        <Link href={`/products/${product.category.slug}`} className="hover:text-foreground">{product.category.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Image */}
        <div>
          {images.length > 0 && images[selectedImage] ? (
            <>
              <div className="aspect-square bg-muted rounded-lg mb-4 overflow-hidden relative">
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
                  {images.slice(0, 8).filter(Boolean).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`aspect-square bg-muted rounded cursor-pointer hover:ring-2 ring-primary overflow-hidden relative ${
                        selectedImage === i ? 'ring-2 ring-primary' : ''
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
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Product image coming soon</p>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-xl text-muted-foreground mb-6">{product.shortDesc}</p>
          
          {/* Price */}
          {product.priceRange && (
            <div className="mb-6">
              <p className="text-2xl font-bold text-primary">{product.priceRange}</p>
              <p className="text-sm text-muted-foreground">Starting price, final quote based on specifications</p>
            </div>
          )}

          {/* Add to Quote */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <Button 
                variant="primary" 
                size="lg"
                onClick={handleAddToQuote}
                className="w-full"
              >
                {addedToQuote ? `Added to Quote ✓ (${quoteCount})` : 'Add to Quote'}
              </Button>

              <p className="mt-3 text-center text-sm text-muted-foreground">
                We confirm measurements and quantities before your quotation is prepared.
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

          {/* Product Overview */}
          {product.description && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </section>
          )}

          {/* Required Materials */}
          {specifications.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Required Materials</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                What this job is built from and what we need from you. Piece counts
                are for a typical unit and are confirmed with you before your
                quotation is prepared.
              </p>
              <ItemGroup className="gap-3">
                {specifications.map((spec) => (
                  <Item key={spec.label} variant="muted">
                    <ItemMedia variant="icon">
                      <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-2">{spec.material}</ItemTitle>
                      <ItemDescription>{spec.label}</ItemDescription>
                    </ItemContent>
                    {spec.pieces !== null && (
                      <ItemActions>
                        <Badge variant="neutral" shape="pill">
                          {spec.pieces} {spec.pieces === 1 ? "piece" : "pieces"}
                        </Badge>
                      </ItemActions>
                    )}
                  </Item>
                ))}
              </ItemGroup>
            </section>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">You May Also Like</h2>
              <div className="grid grid-cols-2 gap-4">
                {relatedProducts.slice(0, 4).map((related) => (
                  <Link key={related.id} href={`/products/${related.category.slug}/${related.slug}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm">{related.name}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Final CTA */}
          <section className="bg-muted/50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Request a Quotation</h2>
            <p className="text-muted-foreground mb-6">
              Add this product to your quote and we'll provide pricing and next steps
            </p>
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="lg">
                Ask TijwaWelders on WhatsApp
              </Button>
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
