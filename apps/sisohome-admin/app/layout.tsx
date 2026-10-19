import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata, Viewport } from "next"

import "@workspace/ui/globals.css"
import "./theme.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@workspace/auth-ui"
import { SwRegister } from "@/components/sw-register"
import { Toaster } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "SisoHome — Property Operations",
    template: "%s · SisoHome",
  },
  description:
    "Light, calm property-operations workspace for landlords, property managers, and maintenance teams.",
  manifest: "/manifest.webmanifest",
  applicationName: "SisoHome",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SisoHome",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="bottom-center" />
            <SwRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
