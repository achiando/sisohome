"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

export interface RadioGroupProps
  extends React.ComponentProps<typeof RadioGroupPrimitive.Root> {
  orientation?: "horizontal" | "vertical"
}

function RadioGroup({
  className,
  orientation = "vertical",
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      data-orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? "flex flex-wrap items-center gap-4 sm:gap-6"
          : "grid w-full gap-3",
        className
      )}
      {...props}
    />
  )
}

const radioGroupItemVariants = cva(
  "group/radio-group-item peer relative flex aspect-square shrink-0 rounded-full border border-input bg-background transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-5", // 20px (Material mobile touch standard)
        lg: "size-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface RadioGroupItemProps
  extends React.ComponentProps<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioGroupItemVariants> {
  label?: React.ReactNode
  description?: React.ReactNode
}

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size = "md", label, description, id, ...props }, ref) => {
  const itemId = id || React.useId()
  const descId = `${itemId}-desc`

  const radioElement = (
    <RadioGroupPrimitive.Item
      ref={ref}
      id={itemId}
      data-slot="radio-group-item"
      aria-describedby={description ? descId : undefined}
      className={cn(radioGroupItemVariants({ size }), className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center"
      >
        <span
          className={cn(
            "rounded-full bg-primary-foreground",
            size === "lg" ? "size-2.5" : size === "sm" ? "size-1.5" : "size-2"
          )}
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )

  if (!label && !description) {
    return radioElement
  }

  return (
    <div className="flex items-start gap-2.5 select-none">
      <div className="flex items-center pt-0.5">{radioElement}</div>
      <div className="flex flex-col gap-0.5">
        {label && (
          <label
            htmlFor={itemId}
            className="text-xs sm:text-sm font-medium leading-tight text-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        {description && (
          <p id={descId} className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem, radioGroupItemVariants }
