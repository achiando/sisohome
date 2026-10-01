"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
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
  type QuoteItem,
} from "@/lib/quote-basket"

export function QuoteClient() {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])

  useEffect(() => {
    setQuoteItems(getQuoteBasket())
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

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Your Quote</h1>
        <p className="text-muted-foreground">
          {quoteItems.length === 0
            ? "Your quote is empty. Add products to request a quotation."
            : `${quoteItems.length} product${quoteItems.length !== 1 ? "s" : ""} — ${totalItems} item${totalItems !== 1 ? "s" : ""} in total`}
        </p>
      </div>

      {quoteItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-6">
              No products in your quote yet.
            </p>
            <Link href="/products">
              <Button variant="primary">Browse Products</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {quoteItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        <Link
                          href={`/products/${item.categorySlug}/${item.slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {item.name}
                        </Link>
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {item.unit && <span>Sold per {item.unit}</span>}
                        {item.price && <span>· {item.price}</span>}
                      </div>
                      {item.sourceProject && (
                        <Badge variant="neutral" shape="pill" className="mt-2">
                          For {item.sourceProject}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div
                        className="flex items-center border rounded-xl"
                        role="group"
                        aria-label={`Quantity for ${item.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="px-3 h-11 hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <span className="w-12 text-center text-sm font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="px-3 h-11 hover:bg-muted transition-colors"
                        >
                          <Plus className="size-4" aria-hidden="true" />
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
            ))}
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <Button variant="outline" onClick={handleClear} className="w-full md:w-auto">
              Clear Quote
            </Button>

            <div className="flex gap-4 w-full md:w-auto">
              <Link href="/products" className="flex-1">
                <Button variant="outline" className="w-full">
                  Continue Browsing
                </Button>
              </Link>

              <a
                href={getWhatsAppLink(quoteItems)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="primary" className="w-full">
                  Request Quote on WhatsApp
                </Button>
              </a>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              This sends your list to us on WhatsApp. Nothing is ordered or paid
              for online — we reply with a quotation.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
