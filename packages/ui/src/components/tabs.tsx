"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col data-vertical:flex-row w-full",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center text-muted-foreground transition-all max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl",
  {
    variants: {
      variant: {
        default: "bg-muted p-1 rounded-xl",
        pill: "bg-muted/60 p-1.5 rounded-full gap-1",
        line: "gap-4 bg-transparent border-b border-border/80 rounded-none p-0 w-full justify-start",
        table:
          "h-auto gap-0 rounded-xl border border-border bg-background p-0",
      },
      size: {
        sm: "group-data-horizontal/tabs:h-9",
        md: "group-data-horizontal/tabs:h-11", // 44px mobile touch target
        lg: "group-data-horizontal/tabs:h-12", // 48px M3 touch target
      },
      fullWidth: {
        true: "w-full flex",
        false: "w-fit",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      fullWidth: false,
    },
  }
)

export interface TabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

function TabsList({
  className,
  variant = "default",
  size = "md",
  fullWidth = false,
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  )
}

export interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  icon?: React.ElementType
  count?: number
}

function TabsTrigger({
  className,
  icon: Icon,
  count,
  children,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap text-muted-foreground transition-all select-none outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Default variant active state
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-xs",
        // Pill variant active state
        "group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:data-active:bg-primary group-data-[variant=pill]/tabs-list:data-active:text-primary-foreground group-data-[variant=pill]/tabs-list:data-active:shadow-xs",
        // Line variant active state (M3 Primary Tab)
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-4 group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:data-active:border-primary group-data-[variant=line]/tabs-list:data-active:text-primary group-data-[variant=line]/tabs-list:data-active:font-semibold",
        // Table variant active state
        "group-data-[variant=table]/tabs-list:justify-start group-data-[variant=table]/tabs-list:rounded-none group-data-[variant=table]/tabs-list:border-0 group-data-[variant=table]/tabs-list:border-r group-data-[variant=table]/tabs-list:px-4 group-data-[variant=table]/tabs-list:py-2.5 group-data-[variant=table]/tabs-list:last:border-r-0 group-data-[variant=table]/tabs-list:data-active:bg-muted group-data-[variant=table]/tabs-list:data-active:text-foreground",
        // Vertical layout
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:rounded-xl group-data-vertical/tabs:px-3.5 group-data-vertical/tabs:py-2",
        className
      )}
      {...props}
    >
      {Icon && (
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-current [&_svg]:size-4">
          <Icon />
        </span>
      )}
      {children && <span>{children}</span>}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold tabular-nums",
            "bg-muted text-muted-foreground",
            "group-data-active/tabs-trigger:bg-primary/10 group-data-active/tabs-trigger:text-primary",
            "group-data-[variant=pill]/tabs-list:group-data-active/tabs-trigger:bg-primary-foreground/20 group-data-[variant=pill]/tabs-list:group-data-active/tabs-trigger:text-primary-foreground"
          )}
        >
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none mt-2", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
