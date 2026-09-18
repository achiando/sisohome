"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

// ─── Circular Loader (Material 3 Circular Progress) ──────────────────────────

const circularVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-3.5", // 14px (badges, compact inputs)
      sm: "size-4.5", // 18px (buttons, standard inputs)
      md: "size-6",   // 24px (default inline, dropdowns)
      lg: "size-9",   // 36px (cards, modals)
      xl: "size-12",  // 48px (page headers, splash screens)
    },
    variant: {
      primary: "text-primary",
      current: "text-current",
      secondary: "text-secondary-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
      white: "text-white",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "current",
  },
})

export interface LoaderProps
  extends React.SVGAttributes<SVGSVGElement>,
    VariantProps<typeof circularVariants> {
  value?: number // 0 to 100 for determinate progress
  strokeWidth?: number
  track?: boolean
  label?: string
}

/**
 * Material Design 3 Circular Progress Loader.
 * Supports smooth indeterminate rotation or determinate percentage values.
 */
export function Loader({
  size = "md",
  variant = "current",
  value,
  strokeWidth = 3,
  track = true,
  label,
  className,
  ...props
}: LoaderProps) {
  const isDeterminate = typeof value === "number"
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const offset = isDeterminate
    ? circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference
    : undefined

  const loaderElement = (
    <svg
      viewBox="0 0 36 36"
      className={cn(
        circularVariants({ size, variant }),
        !isDeterminate && "animate-spin",
        className
      )}
      role="status"
      aria-label={label || "Loading"}
      aria-valuenow={isDeterminate ? Math.round(value) : undefined}
      aria-valuemin={isDeterminate ? 0 : undefined}
      aria-valuemax={isDeterminate ? 100 : undefined}
      {...props}
    >
      {/* Background Track */}
      {track && (
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
      )}

      {/* Active Indicator Arc */}
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isDeterminate ? circumference : "20 60"}
        strokeDashoffset={isDeterminate ? offset : undefined}
        className="transition-[stroke-dashoffset] duration-300 ease-in-out origin-center"
      />
    </svg>
  )

  if (!label) return loaderElement

  return (
    <div className="inline-flex items-center gap-2">
      {loaderElement}
      <span className="text-xs sm:text-sm font-medium text-foreground/80">{label}</span>
    </div>
  )
}

export const CircularLoader = Loader

// ─── Linear Progress Loader (Material 3 Linear Progress) ─────────────────────

const linearVariants = cva("relative w-full overflow-hidden rounded-full", {
  variants: {
    size: {
      xs: "h-0.5", // 2px (subtle app bar top loader)
      sm: "h-1",   // 4px (default M3 bar)
      md: "h-1.5", // 6px (prominent bar)
      lg: "h-2.5", // 10px (capsule bar)
    },
    variant: {
      primary: "bg-primary/20 [&_[data-slot=bar]]:bg-primary",
      secondary: "bg-secondary [&_[data-slot=bar]]:bg-secondary-foreground",
      destructive: "bg-destructive/20 [&_[data-slot=bar]]:bg-destructive",
      white: "bg-white/20 [&_[data-slot=bar]]:bg-white",
    },
  },
  defaultVariants: {
    size: "sm",
    variant: "primary",
  },
})

export interface LinearLoaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof linearVariants> {
  value?: number // 0 to 100
  label?: string
}

/**
 * Material Design 3 Linear Progress Loader.
 * Indeterminate dual-bar animation or percentage-based bar.
 */
export function LinearLoader({
  size = "sm",
  variant = "primary",
  value,
  label,
  className,
  ...props
}: LinearLoaderProps) {
  const isDeterminate = typeof value === "number"

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          {isDeterminate && <span>{Math.round(value)}%</span>}
        </div>
      )}
      <div
        className={cn(linearVariants({ size, variant }), className)}
        role="progressbar"
        aria-label={label || "Loading"}
        aria-valuenow={isDeterminate ? Math.round(value) : undefined}
        aria-valuemin={isDeterminate ? 0 : undefined}
        aria-valuemax={isDeterminate ? 100 : undefined}
        {...props}
      >
        {isDeterminate ? (
          <div
            data-slot="bar"
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        ) : (
          <>
            <div
              data-slot="bar"
              className="absolute top-0 bottom-0 rounded-full animate-indeterminate-bar"
            />
            <div
              data-slot="bar"
              className="absolute top-0 bottom-0 rounded-full animate-indeterminate-bar-short"
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Bouncing Dots Loader ───────────────────────────────────────────────────

const dotsVariants = cva("inline-flex items-center gap-1.5", {
  variants: {
    size: {
      sm: "[&>span]:size-1.5",
      md: "[&>span]:size-2",
      lg: "[&>span]:size-2.5",
    },
    variant: {
      primary: "[&>span]:bg-primary",
      current: "[&>span]:bg-current",
      muted: "[&>span]:bg-muted-foreground",
      white: "[&>span]:bg-white",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "primary",
  },
})

export interface LoadingDotsProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dotsVariants> {
  label?: string
}

/**
 * Mobile-friendly bouncing dots indicator (chat typing, inline button loading).
 */
export function LoadingDots({
  size = "md",
  variant = "primary",
  label = "Loading",
  className,
  ...props
}: LoadingDotsProps) {
  return (
    <div
      className={cn(dotsVariants({ size, variant }), className)}
      role="status"
      aria-label={label}
      {...props}
    >
      <span className="rounded-full animate-dot-bounce [animation-delay:-0.32s]" />
      <span className="rounded-full animate-dot-bounce [animation-delay:-0.16s]" />
      <span className="rounded-full animate-dot-bounce" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

// ─── Full-Page / Container PageLoader ────────────────────────────────────────

export interface PageLoaderProps {
  title?: string
  description?: string
  className?: string
}

/**
 * Full page or section centered loading screen matching Material 3 surface.
 */
export function PageLoader({
  title = "Loading...",
  description,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none animate-in fade-in duration-200",
        className
      )}
    >
      <Loader size="xl" variant="primary" className="mb-4" />
      <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────

export interface LoadingOverlayProps {
  show: boolean
  text?: string
  blur?: boolean
  children?: React.ReactNode
  className?: string
}

/**
 * Semi-transparent loading overlay to prevent clicks during data saves/updates.
 */
export function LoadingOverlay({
  show,
  text,
  blur = true,
  children,
  className,
}: LoadingOverlayProps) {
  if (!show) return <>{children}</>

  return (
    <div className="relative">
      {children}
      <div
        className={cn(
          "absolute inset-0 z-40 flex flex-col items-center justify-center gap-2.5 rounded-[inherit] bg-background/70 animate-in fade-in duration-150 select-none",
          blur && "backdrop-blur-xs",
          className
        )}
      >
        <Loader size="lg" variant="primary" />
        {text && (
          <span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-wide">
            {text}
          </span>
        )}
      </div>
    </div>
  )
}
