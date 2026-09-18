// components/analytics/metric-card.tsx

"use client"

import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { MetricCardDef } from "@workspace/ui/types/components"

const ACCENT_CLASSES: Record<NonNullable<MetricCardDef["accent"]>, string> = {
  primary: "border-l-primary",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-destructive",
  info: "border-l-info",
}

const TREND_CONFIG = {
  positive: {
    icon: TrendingUp,
    className: "text-success",
  },
  negative: {
    icon: TrendingDown,
    className: "text-destructive",
  },
  neutral: {
    icon: Minus,
    className: "text-muted-foreground",
  },
}

export function MetricCard({
  label,
  value,
  displayValue,
  trend,
  trendDirection = "neutral",
  comparisonLabel,
  icon: Icon,
  accent = "primary",
  compact,
  onDrillDown,
}: MetricCardDef) {
  const trendCfg = TREND_CONFIG[trendDirection] ?? TREND_CONFIG.neutral
  const TrendIcon = trendCfg.icon
  const trendClass = trendCfg.className
  const isClickable = !!onDrillDown

  return (
    <div
      onClick={onDrillDown}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable ? (e) => e.key === "Enter" && onDrillDown?.() : undefined
      }
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card",
        "border-l-4",
        ACCENT_CLASSES[accent],
        compact ? "gap-1.5 p-3" : "gap-3 p-5",
        isClickable &&
          "cursor-pointer transition-shadow hover:border-border/80 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-medium tracking-wider text-muted-foreground uppercase",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {Icon && (
            <Icon
              className={cn(
                "text-muted-foreground",
                compact ? "h-3 w-3" : "h-4 w-4"
              )}
            />
          )}
          {isClickable && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>
      </div>

      {/* Value */}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-bold tracking-tight text-foreground tabular-nums",
            compact ? "text-xl" : "text-3xl"
          )}
        >
          {displayValue ?? value}
        </span>

        {(trend || comparisonLabel) && (
          <div className="flex items-center gap-1.5">
            {trend && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trendClass
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {trend}
              </span>
            )}
            {comparisonLabel && (
              <span className="text-xs text-muted-foreground">
                {comparisonLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
