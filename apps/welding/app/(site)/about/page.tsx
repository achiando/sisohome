import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

export const metadata = {
  title: "About TijwaWelders - Steel Fabricators in Nairobi, Kenya",
  description: "Learn about TijwaWelders, a Nairobi steel fabrication company building gates, doors, railings and custom metal fabrication across Kenya.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/about`,
  },
}

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">About TijwaWelders</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Premium steel fabrication built on expertise and quality
        </p>
      </div>

      {/* Who We Are */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">Who We Are</h2>
        <p className="text-muted-foreground max-w-3xl mb-6">
          TijwaWelders is a professional steel fabrication company serving customers across Kenya. 
          We specialize in creating high-quality steel gates, doors, windows, railings, and custom 
          metal fabrication for residential, commercial, and structural projects.
        </p>
        <p className="text-muted-foreground max-w-3xl">
          With years of experience in metal fabrication, we combine technical expertise with practical 
          solutions to deliver products that meet your exact specifications and stand the test of time.
        </p>
      </section>

      {/* What We Do */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Custom Fabrication</h3>
            <p className="text-sm text-muted-foreground">
              We design and build custom steel products to your exact specifications
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Quality Materials</h3>
            <p className="text-sm text-muted-foreground">
              We use only high-quality steel materials for durability and strength
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Professional Installation</h3>
            <p className="text-sm text-muted-foreground">
              Our team handles professional installation of all fabricated products
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Expert Consultation</h3>
            <p className="text-sm text-muted-foreground">
              We help you choose the right materials and designs for your project
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">Why Customers Work With Us</h2>
        <ul className="space-y-3 max-w-2xl">
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">Expert craftsmanship with attention to detail</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">High-quality materials and finishes</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">Custom solutions for unique requirements</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">Professional installation and support</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">Transparent pricing and clear communication</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span className="text-muted-foreground">Timely project completion</span>
          </li>
        </ul>
      </section>

      {/* CTA */}
      <section className="bg-muted/50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Work With Us?</h2>
        <p className="text-muted-foreground mb-6">Let's discuss your fabrication project</p>
        <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
          <Button variant="primary" size="lg">Contact on WhatsApp</Button>
        </a>
      </section>
    </div>
  )
}
