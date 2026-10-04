"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Minus, Plus, ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import {
  getQuoteBasket,
  removeFromQuoteBasket,
  updateQuoteQuantity,
  clearQuoteBasket,
  getWhatsAppLink,
  getItemPriceCents,
  type QuoteItem,
} from "@/lib/quote-basket"
import { formatKsh, VAT_RATE } from "@/lib/money"

export function QuoteClient() {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setQuoteItems(getQuoteBasket())
    setHydrated(true)
  }, [])

  const handleRemove = (id: string) => {
    setQuoteItems(removeFromQuoteBasket(id))
  }

  const handleQuantityChange = (id: string, quantity: number) => {
    setQuoteItems(updateQuoteQuantity(id, quantity))
  }

  const handleClear = () => {
    clearQuoteBasket()
    setQuoteItems([])
  }

  const totalItems = quoteItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotalCents = quoteItems.reduce((sum, item) => {
    const cents = getItemPriceCents(item)
    return cents === null ? sum : sum + cents * item.quantity
  }, 0)
  const taxCents = Math.round(subtotalCents * VAT_RATE)
  const totalCents = subtotalCents + taxCents
  const hasUnpriced = quoteItems.some((item) => getItemPriceCents(item) === null)

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Your Quote</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {!hydrated
            ? "Loading your quote…"
            : quoteItems.length === 0
              ? "Your quote is empty. Add products to request a quotation."
              : `${quoteItems.length} product${quoteItems.length !== 1 ? "s" : ""} — ${totalItems} item${totalItems !== 1 ? "s" : ""} in total`}
        </p>
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="space-y-3 md:space-y-4" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="h-24 animate-pulse bg-muted/50 p-6" />
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="h-64 animate-pulse bg-muted/50 p-6" />
          </Card>
        </div>
      ) : quoteItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBasket className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mb-6 text-muted-foreground">
              No products in your quote yet.
            </p>
            <Link href="/products">
              <Button variant="primary" size="lg">
                Browse Products
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          {/* Items */}
          <div>
            <ul className="space-y-3 md:space-y-4">
              {quoteItems.map((item) => {
                const unitCents = getItemPriceCents(item)
                const lineCents = unitCents === null ? null : unitCents * item.quantity
                return (
                <li key={item.id}>
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold sm:text-lg">
                            <Link
                              href={`/products/${item.categorySlug}/${item.slug}`}
                              className="transition-colors hover:text-primary"
                            >
                              {item.name}
                            </Link>
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            {item.unit && <span>Sold per {item.unit}</span>}
                            {item.price && <span>· {item.price}</span>}
                            {item.quantity > 1 && lineCents !== null && (
                              <span className="font-medium text-foreground">
                                · {formatKsh(lineCents)}
                              </span>
                            )}
                          </div>
                          {item.sourceProject && (
                            <Badge variant="neutral" shape="pill" className="mt-2">
                              For {item.sourceProject}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div
                            className="flex items-center rounded-xl border"
                            role="group"
                            aria-label={`Quantity for ${item.name}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="h-11 w-11 transition-colors hover:bg-muted disabled:opacity-40"
                            >
                              <Minus className="mx-auto size-4" aria-hidden="true" />
                            </button>
                            <span className="w-10 text-center text-sm font-medium tabular-nums sm:w-12">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="h-11 w-11 transition-colors hover:bg-muted"
                            >
                              <Plus className="mx-auto size-4" aria-hidden="true" />
                            </button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(item.id)}
                            aria-label={`Remove ${item.name} from quote`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
                )
              })}
            </ul>

            <div className="mt-4">
              <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
                Clear Quote
              </Button>
            </div>
          </div>

          {/* Summary */}
          <Card className="lg:sticky lg:top-24">
            <CardContent className="p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Quote Summary</h2>

              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium tabular-nums">{formatKsh(subtotalCents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Tax (VAT {Math.round(VAT_RATE * 100)}%)</dt>
                  <dd className="font-medium tabular-nums">{formatKsh(taxCents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Shipment</dt>
                  <dd className="text-muted-foreground">Not included</dd>
                </div>
              </dl>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-bold tabular-nums">{formatKsh(totalCents)}</span>
              </div>

              {hasUnpriced && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Items without a listed price are excluded from the total and
                  priced in your quotation.
                </p>
              )}

              <div className="mt-5 space-y-3">
                <a
                  href={getWhatsAppLink(quoteItems)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="primary" size="lg" className="w-full">
                    Request Quote on WhatsApp
                  </Button>
                </a>
                <Link href="/products" className="block">
                  <Button variant="outline" size="lg" className="w-full">
                    Continue Browsing
                  </Button>
                </Link>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                This sends your list to us on WhatsApp. Nothing is ordered or
                paid for online — we reply with a quotation. Prices exclude
                shipment until confirmed.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
