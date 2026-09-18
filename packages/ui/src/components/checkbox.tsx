"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"
import { CheckIcon } from "lucide-react"

const checkboxVariants = cva(
  "peer relative flex shrink-0 items-center justify-center rounded-md border border-input bg-background transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
  {
    variants: {
      size: {
        sm: "size-4 rounded",
        md: "size-5 rounded-md", // 20px (Material mobile touch standard)
        lg: "size-6 rounded-md",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: string
}

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "md", label, description, error, id, ...props }, ref) => {
  const checkboxId = id || React.useId()
  const descriptionId = `${checkboxId}-desc`
  const errorId = `${checkboxId}-error`

  const checkboxElement = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      data-slot="checkbox"
      aria-describedby={
        error ? errorId : description ? descriptionId : undefined
      }
      aria-invalid={!!error || undefined}
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon className={size === "lg" ? "size-4.5" : size === "sm" ? "size-3" : "size-3.5"} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label && !description && !error) {
    return checkboxElement
  }

  return (
    <div className="flex items-start gap-2.5 select-none">
      <div className="flex items-center pt-0.5">{checkboxElement}</div>
      <div className="flex flex-col gap-0.5">
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-xs sm:text-sm font-medium leading-tight text-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        {description && (
          <p id={descriptionId} className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-destructive font-medium leading-relaxed">
            {error}
          </p>
        )}
      </div>
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox, checkboxVariants }
