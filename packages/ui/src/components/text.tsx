import React from "react"
import { cn } from "@workspace/ui/lib/utils"

// Material Design 3 inspired typography contract using CSS design tokens
export const TEXT_VARIANTS = {
  // M3 Headings & Titles
  display: "text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground",
  headline: "text-xl sm:text-2xl font-bold tracking-tight text-foreground",
  title: "text-base sm:text-lg font-semibold text-foreground",
  h1: "text-2xl font-bold tracking-tight text-foreground",
  h2: "text-xl font-semibold tracking-tight text-foreground",
  h3: "text-lg font-medium text-foreground",

  // Body
  body: "text-sm text-foreground/90 leading-relaxed",
  bodyMuted: "text-sm text-muted-foreground leading-relaxed",
  bodySm: "text-xs text-foreground/80 leading-relaxed",

  // Labels & Captions
  label: "text-xs font-semibold text-foreground/80 tracking-wide",
  caption: "text-xs text-muted-foreground",

  // UI States
  error: "text-xs sm:text-sm text-destructive font-medium",
  success: "text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium",
  warning: "text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium",

  // Buttons & Tables
  button: "text-sm font-medium",
  tableHeader: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
  tableCell: "text-sm text-foreground align-middle",
} as const

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: keyof typeof TEXT_VARIANTS
  as?: React.ElementType
  children: React.ReactNode
  className?: string
}

export function Text({
  variant = "body",
  as: Component = "p",
  children,
  className = "",
  ...props
}: TextProps) {
  const ComponentToRender = Component

  return (
    <ComponentToRender
      className={cn(TEXT_VARIANTS[variant], className)}
      {...props}
    >
      {children}
    </ComponentToRender>
  )
}
