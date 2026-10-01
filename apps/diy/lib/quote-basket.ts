export interface QuoteItem {
  id: string
  name: string
  categorySlug: string
  slug: string
  quantity: number
  unit: string | null
  price: string | null
  sourceProject: string | null
}

const QUOTE_BASKET_KEY = "tijwa_diy_quote_basket"

export function getQuoteBasket(): QuoteItem[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(QUOTE_BASKET_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addToQuoteBasket(item: QuoteItem): QuoteItem[] {
  const basket = getQuoteBasket()
  const existing = basket.find((i) => i.id === item.id)

  if (existing) {
    existing.quantity += item.quantity
    if (!existing.sourceProject && item.sourceProject) {
      existing.sourceProject = item.sourceProject
    }
  } else {
    basket.push(item)
  }

  localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(basket))
  return basket
}

export function addProjectToQuoteBasket(items: QuoteItem[]): QuoteItem[] {
  let basket = getQuoteBasket()
  for (const item of items) {
    basket = addToQuoteBasket(item)
  }
  localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(basket))
  return basket
}

export function removeFromQuoteBasket(id: string): QuoteItem[] {
  const basket = getQuoteBasket().filter((item) => item.id !== id)
  localStorage.setItem(QUOTE_BASKET_KEY, JSON.stringify(basket))
  return basket
}

export function updateQuoteQuantity(id: string, quantity: number): QuoteItem[] {
  const basket = getQuoteBasket()
  const item = basket.find((i) => i.id === id)

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
  return getQuoteBasket().length
}

function formatItemLine(item: QuoteItem, index: number): string {
  const unit = item.unit ? ` (${item.unit})` : ""
  const price = item.price ? ` — ${item.price}` : ""
  return `${index}. ${item.name} — Qty ${item.quantity}${unit}${price}`
}

export function generateWhatsAppMessage(items: QuoteItem[]): string {
  const firstProject = items[0]?.sourceProject ?? null
  const allFromOneProject =
    items.length > 0 &&
    firstProject !== null &&
    items.every((item) => item.sourceProject === firstProject)

  const lines = items.map((item, index) => {
    const line = formatItemLine(item, index + 1)
    if (!allFromOneProject && item.sourceProject) {
      return `${line} (for ${item.sourceProject})`
    }
    return line
  })

  const heading = allFromOneProject
    ? `I would like a quotation for the products needed for the ${firstProject}:`
    : "I would like a quotation for:"

  const message = `Hello TijwaWelders DIY,

${heading}

${lines.join("\n")}

Please provide a quotation and advise on availability and next steps.

Thank you.`

  return encodeURIComponent(message)
}

export function getWhatsAppLink(items: QuoteItem[]): string {
  const message = generateWhatsAppMessage(items)
  const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254XXXXXXXXXX"
  return `https://wa.me/${phoneNumber}?text=${message}`
}

export function getWhatsAppBaseLink(): string {
  const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254XXXXXXXXXX"
  return `https://wa.me/${phoneNumber}`
}
