interface StructuredDataProps {
  type: "LocalBusiness" | "Product" | "BreadcrumbList"
  data: Record<string, unknown>
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function LocalBusinessSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ""
  const phoneNumber = whatsappNumber.replace(/\D/g, "")

  const data = {
    name: "TijwaWelders",
    description: "Premium steel fabrication for residential, commercial, and structural projects in Kenya",
    url: baseUrl,
    telephone: `+254${phoneNumber}`,
    email: "info@tijwawelders.com",
    sameAs: [
      "https://www.google.com/share.google?q=w3rbAa3ILuRMmdey",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Nairobi",
      addressCountry: "KE",
    },
    geo: {
      "@type": "GeoCoordinates",
      addressCountry: "KE",
    },
    areaServed: {
      "@type": "Country",
      name: "Kenya",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "08:00",
        closes: "18:00",
      },
    ],
    priceRange: "$$",
  }

  return <StructuredData type="LocalBusiness" data={data} />
}

interface ProductSchemaProps {
  name: string
  description: string
  category: string
  priceRange?: string
  images?: string[]
  url: string
}

export function ProductSchema({ name, description, category, priceRange, images, url }: ProductSchemaProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"

  const data = {
    name,
    description,
    category,
    offers: priceRange ? {
      "@type": "AggregateOffer",
      priceCurrency: "KES",
      priceRange: priceRange,
      availability: "https://schema.org/InStock",
      url: `${baseUrl}${url}`,
      seller: {
        "@type": "Organization",
        name: "TijwaWelders",
      },
    } : undefined,
    image: images,
    url: `${baseUrl}${url}`,
  }

  return <StructuredData type="Product" data={data} />
}

interface BreadcrumbSchemaProps {
  items: Array<{ name: string; url: string }>
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"

  const data = {
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  }

  return <StructuredData type="BreadcrumbList" data={data} />
}
