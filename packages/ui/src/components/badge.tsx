import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-all select-none",
  {
    variants: {
      variant: {
        default: "border border-border bg-muted/60 text-foreground",
        neutral: "border border-border bg-muted/60 text-foreground",
        primary: "border border-transparent bg-primary text-primary-foreground",
        success:
          "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        warning:
          "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
        error:
          "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300",
        info:
          "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300",
        outline: "border border-border bg-transparent text-foreground",
        purple:
          "border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300",
        indigo:
          "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
        lg: "h-8 px-3 text-xs sm:text-sm", // Mobile touch friendly chip
      },
      shape: {
        rounded: "rounded-lg",
        pill: "rounded-full",
      },
      dot: {
        true: "",
        false: "",
      },
      removable: {
        true: "pr-1",
        false: "",
      },
      interactive: {
        true: "cursor-pointer hover:opacity-85 active:scale-[0.96] shadow-xs",
        false: "",
      },
      selected: {
        true: "border-primary bg-primary text-primary-foreground shadow-xs font-semibold",
        false: "",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
      shape: "rounded",
      dot: false,
      removable: false,
      interactive: false,
      selected: false,
    },
  }
)

const dotColorMap: Record<string, string> = {
  default: "bg-muted-foreground",
  neutral: "bg-muted-foreground",
  primary: "bg-primary-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  outline: "bg-muted-foreground",
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
}

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  icon?: React.ElementType
  onRemove?: () => void
  interactive?: boolean
  selected?: boolean
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      shape = "rounded",
      dot = false,
      removable = false,
      interactive = false,
      selected = false,
      icon: Icon,
      onRemove,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || !!onClick

    return (
      <span
        ref={ref}
        data-slot="badge"
        data-variant={variant}
        data-selected={selected}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onClick?.(e as any)
                }
              }
            : undefined
        }
        className={cn(
          badgeVariants({
            variant: selected ? undefined : variant,
            size,
            shape,
            dot,
            removable,
            interactive: isInteractive,
            selected,
          }),
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "h-1.5 w-1.5 flex-shrink-0 rounded-full",
              selected ? "bg-primary-foreground" : variant && dotColorMap[variant]
            )}
          />
        )}
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
        {children}
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:outline-none"
            aria-label="Remove badge"
          >
            <svg
              className="h-2.5 w-2.5"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        )}
      </span>
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
