import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export const metadata = {
  title: "Materials & Guides - TijwaWelders Steel Education",
  description: "Learn about steel materials, gauges, and fabrication. Understand steel tubes, sheets, and specifications before your project.",
}

export default function GuidesPage() {
  const guides = [
    {
      title: 'Gauge 16 vs Gauge 18 Steel',
      description: 'Understanding the difference between steel gauges and when to use each',
      slug: 'gauge-16-vs-gauge-18-steel'
    },
    {
      title: 'What is a 3/4" Steel Tube?',
      description: 'Common steel tube sizes and their applications',
      slug: 'what-is-3-4-steel-tube'
    },
    {
      title: 'Choosing Steel for a Gate',
      description: 'Select the right steel material for your gate project',
      slug: 'choosing-steel-for-gate'
    },
    {
      title: 'Common Steel Sections',
      description: 'Understanding different steel profiles and their uses',
      slug: 'common-steel-sections'
    },
    {
      title: 'Steel Sheet vs Steel Plate',
      description: 'When to use sheets versus plates in fabrication',
      slug: 'steel-sheet-vs-steel-plate'
    },
    {
      title: 'Steel Finishes Guide',
      description: 'Understanding different steel finishes and protection',
      slug: 'steel-finishes-guide'
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Materials & Guides</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Understand steel before you start your project
        </p>
      </div>

      {/* Guides Grid */}
      <div className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map((guide) => (
            <Card key={guide.slug} className="h-full">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{guide.title}</h3>
                <p className="text-muted-foreground">{guide.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Related Products */}
      <div className="bg-muted/50 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Need Steel Products?</h2>
        <p className="text-muted-foreground mb-6">Browse our fabricated steel products</p>
        <Link href="/products">
          <Button variant="primary">Explore Products</Button>
        </Link>
      </div>
    </div>
  )
}
