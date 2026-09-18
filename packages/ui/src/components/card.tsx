import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

// Card variants following Material Design 3 surface and elevation specs
const cardVariants = cva(
  "flex flex-col overflow-hidden text-card-foreground rounded-2xl transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border border-border/80 bg-card shadow-xs",
        elevated:
          "border border-border/40 bg-card shadow-sm hover:shadow-md hover:border-border/60",
        filled: "bg-muted/40 border border-transparent hover:bg-muted/60",
        outlined: "border border-border bg-card",
        ghost: "border-0 bg-transparent shadow-none",
        interactive:
          "cursor-pointer border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 active:scale-[0.99] active:shadow-xs",
      },
      size: {
        sm: "gap-3 p-3",
        md: "gap-4 p-4 sm:p-5",
        lg: "gap-5 p-5 sm:p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  interactive?: boolean
}

function Card({
  className,
  variant,
  size,
  interactive,
  ...props
}: CardProps) {
  const effectiveVariant = interactive ? "interactive" : variant
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant: effectiveVariant, size }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base sm:text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs sm:text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex items-center gap-2 shrink-0", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex items-center border-t border-border/60 pt-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
