import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export const metadata = {
  title: "Services - TijwaWelders Fabrication Services",
  description: "Professional welding and fabrication services. Gate fabrication, steel doors, structural steel, installation, and metal repairs.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/services`,
  },
}

export default function ServicesPage() {
  const services = [
    {
      name: 'Welding & Fabrication',
      description: 'Custom welding and metal fabrication for all project types',
      slug: 'welding-fabrication'
    },
    {
      name: 'Gate Fabrication',
      description: 'Custom steel gates designed and built to your specifications',
      slug: 'gate-fabrication'
    },
    {
      name: 'Steel Door Fabrication',
      description: 'Heavy-duty security doors for residential and commercial use',
      slug: 'steel-door-fabrication'
    },
    {
      name: 'Structural Steel Fabrication',
      description: 'Load-bearing steel structures for buildings and infrastructure',
      slug: 'structural-steel-fabrication'
    },
    {
      name: 'Installation',
      description: 'Professional installation of all fabricated products',
      slug: 'installation'
    },
    {
      name: 'Metal Repairs',
      description: 'Repair and restoration of existing metalwork',
      slug: 'metal-repairs'
    },
    {
      name: 'Commercial Fabrication',
      description: 'Large-scale steel fabrication for commercial projects',
      slug: 'commercial-fabrication'
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Services</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Fabrication for homes, businesses and structural projects
        </p>
      </div>

      {/* Services Grid */}
      <div className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.slug} className="hover:shadow-lg transition-shadow h-full">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                <p className="text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Need a Service?</h2>
        <p className="text-muted-foreground mb-6">Contact us to discuss your fabrication requirements</p>
        <a href="https://wa.me/YOUR_WHATSAPP_NUMBER" target="_blank" rel="noopener noreferrer">
          <Button variant="primary" size="lg">Contact on WhatsApp</Button>
        </a>
      </div>
    </div>
  )
}
