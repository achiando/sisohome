"use client"

import { useCallback } from "react"
import { RefreshCw, X } from "lucide-react"
import { Button } from "../button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select"
import { DateRangePicker } from "./date-range-picker"
import type { DateRange } from "./filter-provider"
import { useFilters } from "./filter-provider"
import { cn } from "@workspace/ui/lib/utils"

export type FilterDef = {
  key: string
  label: string
  type: "select" | "multi-select" | "date-range"
  options?: Array<{ value: string; label: string }>
}

type FilterBarProps = {
  filters: FilterDef[]
  onRefresh?: () => void
  isRefreshing?: boolean
  showDateRange?: boolean
  onDateRangeChange?: (range: DateRange) => void
  dateRange?: DateRange
  className?: string
  labels?: {
    refresh?: string
    clearAll?: string
    selectPlaceholder?: string
  }
}

export function FilterBar({
  filters,
  onRefresh,
  isRefreshing,
  showDateRange = true,
  onDateRangeChange,
  dateRange,
  className,
  labels = {},
}: FilterBarProps) {
  const { filters: ctxFilters, setFilter, resetFilters } = useFilters()

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      onDateRangeChange?.(range)
    },
    [onDateRangeChange]
  )

  const activeFilterCount = Object.values(ctxFilters).filter((v) => {
    if (v === null) return false
    if (Array.isArray(v)) return v.length > 0
    return v !== ""
  }).length

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {/* Date range picker */}
      {showDateRange && onDateRangeChange && dateRange !== undefined && (
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={handleDateRangeChange}
          labels={{
            selectRange: labels.selectPlaceholder ?? "Select range",
            apply: labels.selectPlaceholder ?? "Apply",
          }}
        />
      )}

      {/* Segment filters */}
      {filters.map((f) => (
        <Select
          key={f.key}
          value={(ctxFilters[f.key] as string) ?? "all"}
          onValueChange={(v) => setFilter(f.key, v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-auto min-w-[120px] shrink-0 text-sm">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {f.label}</SelectItem>
            {f.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Clear all */}
      {activeFilterCount > 0 && (
        <button
          onClick={resetFilters}
          className="flex h-9 items-center gap-1.5 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          {labels.clearAll ?? "Clear"}
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 gap-1.5 text-sm"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          {labels.refresh ?? "Refresh"}
        </Button>
      )}
    </div>
  )
}
