import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Search, ClipboardList, MessageCircle, Wrench, FolderKanban } from "lucide-react"

export const metadata: Metadata = {
  title: "About",
  description:
    "TijwaWelders DIY is a product discovery and quotation platform for DIY tools, electronics and project parts. Browse, build a quote and request pricing on WhatsApp.",
  alternates: { canonical: "/about" },
}

const steps = [
  {
    icon: Search,
    title: "Discover",
    body: "Browse categories, search the catalog or open a project to see what a build needs.",
  },
  {
    icon: ClipboardList,
    title: "Build your quote",
    body: "Add products with quantities — or add a whole project's parts list in one action.",
  },
  {
    icon: MessageCircle,
    title: "Send it on WhatsApp",
    body: "Your quote becomes a clear message. No account, no checkout, no payment online.",
  },
  {
    icon: Wrench,
    title: "Get a human quotation",
    body: "We confirm availability, pricing and next steps with you directly.",
  },
]

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">About TijwaWelders DIY</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A product discovery and quotation platform for people who build,
          repair and automate things.
        </p>
      </div>

      <section className="mb-16 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-4">What DIY Is</h2>
        <p className="text-muted-foreground mb-4">
          DIY is the technical catalog arm of TijwaWelders: tools, workshop
          equipment, electronics components, modules, sensors, wiring, power
          and other project parts — organised so you can find what a job
          actually needs instead of guessing.
        </p>
        <p className="text-muted-foreground mb-4">
          Alongside the catalog, the Projects section shows complete builds
          with their steps and the exact parts involved, so a project page can
          become a quote in one click.
        </p>
        <p className="text-muted-foreground">
          DIY is not an online store with a checkout. You browse and assemble
          a quote here; pricing and availability are confirmed by a person on
          WhatsApp.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={step.title} variant="outlined">
              <CardContent className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Step {index + 1}
                </p>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">What You&apos;ll Find</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card variant="outlined">
            <CardContent className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Products</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Browse by category — sensors, modules, prototyping parts,
                electrical, tools and more — with clear specifications on each
                product.
              </p>
              <Link href="/products">
                <Button variant="outline" size="md">
                  Browse Products
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderKanban className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Projects</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Practical builds explained step by step, each linked to the
                products it uses — add a project&apos;s parts to your quote in
                one action.
              </p>
              <Link href="/projects">
                <Button variant="outline" size="md">
                  Explore Projects
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-muted/50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Questions or a project in mind?</h2>
        <p className="text-muted-foreground mb-6">
          WhatsApp is the fastest way to reach us — email works too
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/contact">
            <Button variant="primary" size="lg">
              Contact Us
            </Button>
          </Link>
          <Link href="/quote">
            <Button variant="outline" size="lg">
              View Your Quote
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
