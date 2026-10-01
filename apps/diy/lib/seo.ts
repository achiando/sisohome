const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString()
}

export function siteMeta() {
  return {
    siteName: "TijwaWelders DIY",
    url: siteUrl,
  }
}

type Crumb = { name: string; path: string }

export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function productJsonLd(product: {
  name: string
  description: string
  image: string[]
  url: string
  price?: number | null
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    url: absoluteUrl(product.url),
    ...(product.price != null && Number.isFinite(product.price)
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "KES",
          },
        }
      : {}),
  }
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data)
}
