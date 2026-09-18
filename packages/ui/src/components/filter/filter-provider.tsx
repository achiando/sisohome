"use client"

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export type DateRange = {
  from: string | null
  to: string | null
}

export type FilterValue = string | DateRange | string[] | null

export type Filters = Record<string, FilterValue>

export type FilterConfig = {
  [key: string]: {
    label: string
    type: "select" | "multi-select" | "date-range" | "search"
    options?: Array<{ value: string; label: string }>
    placeholder?: string
  }
}

type FilterContextValue = {
  filters: Filters
  setFilter: (key: string, value: FilterValue) => void
  setFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  isLoading: boolean
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({
  children,
  defaultFilters = {},
  dateRange = { from: null, to: null },
  onDateRangeChange,
}: {
  children: ReactNode
  defaultFilters?: Filters
  dateRange?: DateRange
  onDateRangeChange?: (range: DateRange) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFiltersState] = useState<Filters>(defaultFilters)
  const [dateRangeState, setDateRangeState] = useState<DateRange>(dateRange)
  const [isLoading, setIsLoading] = useState(false)

  // Sync URL params on mount
  useEffect(() => {
    const params: Filters = {}
    searchParams.forEach((value: string, key: string) => {
      if (key === "from" || key === "to") return
      if (key.endsWith("[]")) {
        const realKey = key.slice(0, -2)
        params[realKey] = value.split(",")
      } else {
        params[key] = value
      }
    })
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    if (from || to) {
      setDateRangeState({ from, to })
    }
    if (Object.keys(params).length > 0) {
      setFiltersState(params)
    }
  }, [])

  const updateURL = useCallback(
    (newFilters: Filters, newDateRange?: DateRange) => {
      const params = new URLSearchParams()
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === null || value === "") return
        if (Array.isArray(value)) {
          if (value.length > 0) params.set(`${key}[]`, value.join(","))
        } else {
          params.set(key, String(value))
        }
      })
      if (newDateRange) {
        if (newDateRange.from) params.set("from", newDateRange.from)
        if (newDateRange.to) params.set("to", newDateRange.to)
      }
      const query = params.toString()
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
    },
    [router, pathname]
  )

  const setFilter = useCallback(
    (key: string, value: FilterValue) => {
      setFiltersState((prev) => {
        const next = value === null ? { ...prev } : { ...prev, [key]: value }
        updateURL(next, dateRangeState)
        return next
      })
    },
    [dateRangeState, updateURL]
  )

  const setFilters = useCallback(
    (newFilters: Partial<Filters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...newFilters } as Filters
        updateURL(next, dateRangeState)
        return next
      })
    },
    [dateRangeState, updateURL]
  )

  const resetFilters = useCallback(() => {
    setFiltersState({})
    setDateRangeState({ from: null, to: null })
    router.push(pathname, { scroll: false })
  }, [router, pathname])

  const setDateRange = useCallback(
    (range: DateRange) => {
      setDateRangeState(range)
      onDateRangeChange?.(range)
      updateURL(filters, range)
    },
    [filters, onDateRangeChange, updateURL]
  )

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilter,
        setFilters,
        resetFilters,
        dateRange: dateRangeState,
        setDateRange,
        isLoading,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error("useFilters must be used within FilterProvider")
  return ctx
}
