"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const progressVariants = cva(
  "relative flex w-full items-center overflow-x-hidden rounded-full bg-muted select-none",
  {
    variants: {
      size: {
        xs: "h-1",
        sm: "h-2",
        md: "h-3",
        lg: "h-4",
      },
      variant: {
        primary: "[&_[data-slot=progress-indicator]]:bg-primary",
        secondary: "[&_[data-slot=progress-indicator]]:bg-secondary-foreground",
        success: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
        destructive: "[&_[data-slot=progress-indicator]]:bg-destructive",
      },
    },
    defaultVariants: {
      size: "sm",
      variant: "primary",
    },
  }
)

export interface ProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indeterminate?: boolean
  label?: string
}

function Progress({
  className,
  value,
  size = "sm",
  variant = "primary",
  indeterminate = value === undefined || value === null,
  label,
  ...props
}: ProgressProps) {
  const isDeterminate = !indeterminate && typeof value === "number"

  const progressElement = (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={isDeterminate ? value : undefined}
      className={cn(progressVariants({ size, variant }), className)}
      {...props}
    >
      {isDeterminate ? (
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="size-full flex-1 transition-all duration-300 ease-out rounded-full"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      ) : (
        <>
          <div
            data-slot="progress-indicator"
            className="absolute top-0 bottom-0 rounded-full animate-indeterminate-bar"
          />
          <div
            data-slot="progress-indicator"
            className="absolute top-0 bottom-0 rounded-full animate-indeterminate-bar-short"
          />
        </>
      )}
    </ProgressPrimitive.Root>
  )

  if (!label) return progressElement

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {isDeterminate && <span>{Math.round(value)}%</span>}
      </div>
      {progressElement}
    </div>
  )
}

export { Progress, progressVariants }
