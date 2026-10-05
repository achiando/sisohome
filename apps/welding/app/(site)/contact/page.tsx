import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export const metadata = {
  title: "Contact TijwaWelders - Get a Quote",
  description: "Contact TijwaWelders for steel fabrication quotes. WhatsApp, phone, and email contact information for your project.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tijwawelders.com"}/contact`,
  },
}

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Let's Talk About Your Project</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Get in touch with us for your steel fabrication needs
        </p>
      </div>

      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* WhatsApp */}
        <Card className="border-2 border-primary">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">WhatsApp</h2>
            <p className="text-muted-foreground mb-4">Primary contact channel</p>
            <a 
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} 
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="primary" size="lg" className="w-full">
                Start WhatsApp Conversation
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Phone */}
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Phone</h2>
            <p className="text-muted-foreground mb-4">Call us directly</p>
            <a href="tel:+254YOURNUMBER" className="block">
              <Button variant="outline" size="lg" className="w-full">
                Call
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Email</h2>
            <p className="text-muted-foreground mb-4">Send us an email</p>
            <a href="mailto:info@tijwawelders.com" className="block">
              <Button variant="outline" size="lg" className="w-full">
                Send Email
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Service Area */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Service Area</h2>
        <p className="text-muted-foreground max-w-3xl">
          We serve customers across Kenya with our steel fabrication services. 
          Contact us to discuss your project regardless of your location.
        </p>
      </section>

      {/* Business Info */}
      <section className="bg-muted/50 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Business Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Hours</h3>
            <p className="text-muted-foreground">Monday - Saturday: 8:00 AM - 6:00 PM</p>
            <p className="text-muted-foreground">Sunday: Closed</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Location</h3>
            <p className="text-muted-foreground">Nairobi, Kenya</p>
            <p className="text-muted-foreground">Serving clients nationwide</p>
          </div>
        </div>
      </section>
    </div>
  )
}
