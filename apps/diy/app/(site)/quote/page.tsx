import type { Metadata } from "next"
import { QuoteClient } from "./quote-client"

export const metadata: Metadata = {
  title: "Your Quote",
  description:
    "Review your selected products and request a quotation via WhatsApp.",
  alternates: { canonical: "/quote" },
  robots: { index: false },
}

export default function QuotePage() {
  return <QuoteClient />
}
