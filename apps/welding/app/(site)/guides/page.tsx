import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getAllGuides } from "@/lib/guides"

export const metadata = {
  title: "Steel Guides: Gauges, Tubes & Materials | TijwaWelders",
  description: "Understand steel gauges, square tubes and materials before your fabrication project in Kenya. Practical guides from TijwaWelders.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/guides`,
  },
}

export default async function GuidesPage() {
  const guides = await getAllGuides()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Steel Material Guides</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Learn about steel materials, gauges, and fabrication to make informed decisions for your project.
        </p>
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/guides/${guide.slug}`}>
            <Card className="transition-shadow hover:shadow-lg h-full">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-3">{guide.title}</h3>
                <p className="text-muted-foreground mb-4">{guide.description}</p>
                <Button variant="outline" className="w-full">
                  Read Guide →
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Link href="/products">
          <Button variant="primary" size="lg">
            Explore Products
          </Button>
        </Link>
      </div>
    </div>
  )
}
