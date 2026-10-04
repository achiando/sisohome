import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getGuideBySlug, getAllGuides } from "@/lib/guides"
import { BreadcrumbSchema } from "@/components/structured-data"

interface GuidePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: GuidePageProps) {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)

  if (!guide) {
    return {
      title: "Guide Not Found - TijwaWelders",
      description: "The requested guide could not be found.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"

  return {
    title: `${guide.title} | TijwaWelders Guides`,
    description: guide.description,
    alternates: {
      canonical: `${baseUrl}/guides/${slug}`,
    },
  }
}

export async function generateStaticParams() {
  const guides = await getAllGuides()
  return guides.map((guide) => ({
    slug: guide.slug,
  }))
}

export default async function GuideDetailPage({ params }: GuidePageProps) {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  // Convert markdown-like content to HTML (simple implementation)
  // For production, you might want to use a proper markdown library like react-markdown
  const contentHtml = guide.content
    .replace(/^### (.*$)/gim, '<h3 class="text-2xl font-semibold mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-3xl font-bold mt-10 mb-6">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold mt-8 mb-6">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-6 mb-2">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-6 mb-2">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(cell => cell.trim())
      return `<tr>${cells.map(cell => `<td className="border px-4 py-2">${cell.trim()}</td>`).join('')}</tr>`
    })
    .replace(/<tr>/g, '<tr className="border-b">')

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: guide.title, url: `/guides/${slug}` },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/guides" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Guides
          </Link>
          <h1 className="text-4xl font-bold mb-4">{guide.title}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">{guide.description}</p>
        </div>

        {/* Content */}
        <div className="max-w-4xl">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${contentHtml}</p>` }} />
          </div>
        </div>

        {/* Related Products */}
        {guide.relatedProducts && guide.relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {guide.relatedProducts.map((productSlug) => (
                <Link key={productSlug} href={`/products/${productSlug}`}>
                  <Card className="transition-shadow hover:shadow-lg h-full">
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-2">
                        {productSlug
                          .split('-')
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </h3>
                      <Button variant="outline" className="w-full mt-4">
                        View Product →
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link href="/products">
            <Button variant="primary" size="lg">
              Explore Products
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
