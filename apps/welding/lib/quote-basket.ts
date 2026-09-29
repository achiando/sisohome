export interface QuoteItem {
  id: string
  name: string
  slug: string
  quantity: number
  price?: string
}

const QUOTE_BASKET_KEY = 'tijwawelders_quote_basket'

export function getQuoteBasket(): QuoteItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(QUOTE_BASKET_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function addToQuoteBasket(item: QuoteItem): QuoteItem[] {
  const basket = getQuoteBasket()
  const existingIndex = basket.findIndex(i => i.id === item.id)
  
  if (existingIndex >= 0) {
    const existingItem = basket[existingIndex]
    if (existingItem) {
      existingItem.quantity += item.quantity
    }
  } else {
    basket.push(item)
  }
  
  localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(basket))
  return basket
}

export function removeFromQuoteBasket(id: string): QuoteItem[] {
  const basket = getQuoteBasket()
  const filtered = basket.filter(item => item.id !== id)
  localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(filtered))
  return filtered
}

export function updateQuoteQuantity(id: string, quantity: number): QuoteItem[] {
  const basket = getQuoteBasket()
  const item = basket.find(i => i.id === id)
  
  if (item) {
    if (quantity <= 0) {
      return removeFromQuoteBasket(id)
    }
    item.quantity = quantity
    localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(basket))
  }
  
  return basket
}

export function clearQuoteBasket(): void {
  localStorage.removeItem(QUOTE_BASKET_KEY)
}

export function getQuoteBasketCount(): number {
  return getQuoteBasket().reduce((total, item) => total + item.quantity, 0)
}

export function generateWhatsAppMessage(items: QuoteItem[]): string {
  const message = `Hello TijwaWelders,

I would like to request a quotation for:

${items.map((item, index) => 
  `${index + 1}. ${item.name} — Qty: ${item.quantity}`
).join('\n')}

Please provide a quotation and advise on the next steps.

Thank you.`

  return encodeURIComponent(message)
}

export function getWhatsAppLink(items: QuoteItem[]): string {
  const message = generateWhatsAppMessage(items)
  const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254XXXXXXXXXX'
  return `https://wa.me/${phoneNumber}?text=${message}`
}
