import { Hammer, MapPin } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export const metadata = {
  title: "Welding & Fabrication Services in Nairobi | TijwaWelders",
  description:
    "Custom welding and steel fabrication in Nairobi — workshop-built gates, doors and structural steel, plus on-site installation and repairs. Quote on WhatsApp.",
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

  const approaches = [
    {
      icon: Hammer,
      title: "In Our Workshop",
      description:
        "Gates, doors, window grills, railings and structural pieces built to your measurements in our workshop.",
      points: [
        "Fabricated, finished and checked before leaving the workshop",
        "Built from the measurements and specifications you send us",
        "Delivered and installed at your property",
      ],
    },
    {
      icon: MapPin,
      title: "On Site",
      description:
        "Fitting, welding and installation carried out at your home, business or project site.",
      points: [
        "Installation of everything we fabricate",
        "On-site welding and structural fitting",
        "Repairs and modifications to existing metalwork",
      ],
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Welding & Steel Fabrication Services</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Custom steel fabrication built in our workshop and installed on site,
          for homes, businesses and structural projects
        </p>
      </div>

      {/* Workshop vs On Site */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">
          Custom Work — In Our Workshop or On Site
        </h2>
        <p className="text-muted-foreground mb-6 max-w-2xl">
          Every job is custom. Some pieces are fabricated in our workshop and
          delivered ready to fit; other work is carried out directly at your
          site.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {approaches.map((approach) => {
            const Icon = approach.icon
            return (
              <Card key={approach.title} variant="elevated" className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Icon className="size-6 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-semibold">{approach.title}</h3>
                  <p className="text-muted-foreground">{approach.description}</p>
                  <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                    {approach.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="text-primary">
                          •
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Services Grid */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-6">What We Do</h2>
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
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="primary" size="lg">Contact on WhatsApp</Button>
        </a>
      </div>
    </div>
  )
}
