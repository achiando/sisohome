"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { 
  getQuoteBasket, 
  removeFromQuoteBasket, 
  updateQuoteQuantity, 
  clearQuoteBasket,
  getWhatsAppLink,
  type QuoteItem 
} from "@/lib/quote-basket"

export function QuoteClient() {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

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

  const handleWhatsAppQuote = () => {
    if (quoteItems.length === 0) return
    
    setIsLoading(true)
    const whatsappLink = getWhatsAppLink(quoteItems)
    window.open(whatsappLink, '_blank')
    setIsLoading(false)
  }

  const totalItems = quoteItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Your Quote</h1>
        <p className="text-muted-foreground">
          {totalItems === 0 
            ? "Your quote basket is empty. Add products to request a quotation."
            : `You have ${totalItems} item${totalItems !== 1 ? 's' : ''} in your quote`
          }
        </p>
      </div>

      {quoteItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-6">No items in your quote basket</p>
            <Link href="/products">
              <Button variant="primary">Browse Products</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quote Items */}
          <div className="space-y-4 mb-8">
            {quoteItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      {item.price && (
                        <p className="text-sm text-muted-foreground">{item.price}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center border rounded-lg">
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          className="px-3 py-2 hover:bg-muted transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                          className="w-16 text-center border-0 border-x"
                          min={1}
                        />
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          className="px-3 py-2 hover:bg-muted transition-colors"
                        >
                          +
                        </button>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(item.id)}
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

          {/* Actions */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <Button
              variant="outline"
              onClick={handleClear}
              className="w-full md:w-auto"
            >
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
                <Button 
                  variant="primary" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Request Quote on WhatsApp'}
                </Button>
              </a>
            </div>
          </div>

          {/* Email Option */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Prefer email? Send us your quote request
            </p>
            <a href="mailto:info@tijwawelders.com?subject=Quote Request&body=I would like to request a quotation for the following products">
              <Button variant="ghost" size="sm">
                Email Quote Request
              </Button>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
