"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "../button"
import { Input } from "../input"
import { cn } from "@workspace/ui/lib/utils"

type Preset = {
  label: string
  value: string
  getDates: () => { from: string | null; to: string | null }
}

const TODAY = () => new Date()
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())
const toISO = (d: Date): string => d.toISOString().split("T")[0] ?? ""
const daysAgo = (n: number) => {
  const d = startOfDay(TODAY())
  d.setDate(d.getDate() - n)
  return d
}
const startOfWeek = () => {
  const d = startOfDay(TODAY())
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}
const endOfWeek = () => {
  const d = startOfWeek()
  d.setDate(d.getDate() + 6)
  return d
}
const startOfMonth = () =>
  new Date(TODAY().getFullYear(), TODAY().getMonth(), 1)
const endOfMonth = () =>
  new Date(TODAY().getFullYear(), TODAY().getMonth() + 1, 0)
const startOfQuarter = () => {
  const m = Math.floor(TODAY().getMonth() / 3) * 3
  return new Date(TODAY().getFullYear(), m, 1)
}
const endOfQuarter = () => {
  const m = Math.floor(TODAY().getMonth() / 3) * 3 + 2
  return new Date(TODAY().getFullYear(), m + 1, 0)
}
const startOfYear = () => new Date(TODAY().getFullYear(), 0, 1)
const endOfYear = () => new Date(TODAY().getFullYear(), 11, 31)

function buildPresets(labels: {
  today: string
  yesterday: string
  last7days: string
  last30days: string
  thisWeek: string
  lastWeek: string
  thisMonth: string
  lastMonth: string
  thisQuarter: string
  thisYear: string
}): Preset[] {
  return [
    {
      label: labels.today,
      value: "today",
      getDates: () => ({ from: toISO(TODAY()), to: toISO(TODAY()) }),
    },
    {
      label: labels.yesterday,
      value: "yesterday",
      getDates: () => ({ from: toISO(daysAgo(1)), to: toISO(daysAgo(1)) }),
    },
    {
      label: labels.last7days,
      value: "last7days",
      getDates: () => ({ from: toISO(daysAgo(6)), to: toISO(TODAY()) }),
    },
    {
      label: labels.last30days,
      value: "last30days",
      getDates: () => ({ from: toISO(daysAgo(29)), to: toISO(TODAY()) }),
    },
    {
      label: labels.thisWeek,
      value: "thisWeek",
      getDates: () => ({ from: toISO(startOfWeek()), to: toISO(endOfWeek()) }),
    },
    {
      label: labels.lastWeek,
      value: "lastWeek",
      getDates: () => ({ from: toISO(daysAgo(13)), to: toISO(daysAgo(7)) }),
    },
    {
      label: labels.thisMonth,
      value: "thisMonth",
      getDates: () => ({
        from: toISO(startOfMonth()),
        to: toISO(endOfMonth()),
      }),
    },
    {
      label: labels.lastMonth,
      value: "lastMonth",
      getDates: () => {
        const m = new Date(TODAY().getFullYear(), TODAY().getMonth() - 1, 1)
        return {
          from: toISO(m),
          to: toISO(new Date(m.getFullYear(), m.getMonth() + 1, 0)),
        }
      },
    },
    {
      label: labels.thisQuarter,
      value: "thisQuarter",
      getDates: () => ({
        from: toISO(startOfQuarter()),
        to: toISO(endOfQuarter()),
      }),
    },
    {
      label: labels.thisYear,
      value: "thisYear",
      getDates: () => ({ from: toISO(startOfYear()), to: toISO(endOfYear()) }),
    },
  ]
}

const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const DAYS_ES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"]
const DAYS_PT = ["Do", "Se", "Te", "Qu", "Qi", "Se", "Sá"]
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

function getLocaleDays(locale: string) {
  if (locale === "es") return DAYS_ES
  if (locale === "pt") return DAYS_PT
  return DAYS_EN
}

function getLocaleMonths(locale: string) {
  if (locale === "es") return MONTHS_ES
  if (locale === "pt") return MONTHS_PT
  return MONTHS_EN
}

type DateRangePickerProps = {
  from: string | null
  to: string | null
  onChange: (range: { from: string | null; to: string | null }) => void
  className?: string
  labels?: {
    selectRange?: string
    from?: string
    to?: string
    apply?: string
    clear?: string
    today?: string
    yesterday?: string
    last7days?: string
    last30days?: string
    thisWeek?: string
    lastWeek?: string
    thisMonth?: string
    lastMonth?: string
    thisQuarter?: string
    thisYear?: string
  }
  locale?: string
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  labels = {},
  locale = "en",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(startOfDay(TODAY()))
  const [tempFrom, setTempFrom] = useState<string | null>(from)
  const [tempTo, setTempTo] = useState<string | null>(to)
  const ref = useRef<HTMLDivElement>(null)

  const days = getLocaleDays(locale)
  const months = getLocaleMonths(locale)

  const presets = buildPresets({
    today: labels.today ?? "Today",
    yesterday: labels.yesterday ?? "Yesterday",
    last7days: labels.last7days ?? "Last 7 days",
    last30days: labels.last30days ?? "Last 30 days",
    thisWeek: labels.thisWeek ?? "This week",
    lastWeek: labels.lastWeek ?? "Last week",
    thisMonth: labels.thisMonth ?? "This month",
    lastMonth: labels.lastMonth ?? "Last month",
    thisQuarter: labels.thisQuarter ?? "This quarter",
    thisYear: labels.thisYear ?? "This year",
  })

  useEffect(() => {
    setTempFrom(from)
    setTempTo(to)
  }, [from, to])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function handlePreset(p: Preset) {
    const d = p.getDates()
    setTempFrom(d.from)
    setTempTo(d.to)
    onChange({ from: d.from, to: d.to })
    setOpen(false)
  }

  function handleDayClick(d: Date) {
    const iso = toISO(d)
    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(iso)
      setTempTo(null)
    } else {
      if (iso < tempFrom) {
        setTempFrom(iso)
        setTempTo(tempFrom)
      } else {
        setTempTo(iso)
      }
    }
  }

  function handleApply() {
    onChange({ from: tempFrom, to: tempTo })
    setOpen(false)
  }

  function handleClear() {
    setTempFrom(null)
    setTempTo(null)
    onChange({ from: null, to: null })
    setOpen(false)
  }

  function prevMonth() {
    const d = new Date(viewDate)
    d.setMonth(d.getMonth() - 1)
    setViewDate(d)
  }

  function nextMonth() {
    const d = new Date(viewDate)
    d.setMonth(d.getMonth() + 1)
    setViewDate(d)
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const displayFrom = tempFrom ? new Date(tempFrom + "T00:00:00") : null
  const displayTo = tempTo ? new Date(tempTo + "T00:00:00") : null

  const calendarDays: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++)
    calendarDays.push(new Date(year, month, d))

  const isInRange = (d: Date) => {
    if (!displayFrom || !displayTo) return false
    return d >= displayFrom && d <= displayTo
  }

  const isRangeStart = (d: Date) =>
    displayFrom && toISO(d) === displayFrom.toISOString().split("T")[0]
  const isRangeEnd = (d: Date) =>
    displayTo && toISO(d) === displayTo.toISOString().split("T")[0]

  const displayText = () => {
    if (from && to) {
      const f = new Date(from + "T00:00:00")
      const t = new Date(to + "T00:00:00")
      const opts: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
      }
      return `${f.toLocaleDateString(locale, opts)} — ${t.toLocaleDateString(locale, opts)}`
    }
    if (from) {
      const f = new Date(from + "T00:00:00")
      return `${f.toLocaleDateString(locale, { month: "short", day: "numeric" })} — ...`
    }
    return labels.selectRange ?? "Select range"
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-2 text-sm"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{displayText()}</span>
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-[680px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 shadow-lg">
          <div className="flex gap-6">
            {/* Presets */}
            <div className="w-40 shrink-0 border-r border-border pr-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                {labels.selectRange ?? "Quick select"}
              </p>
              <div className="space-y-0.5">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => handlePreset(p)}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      "hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1">
              {/* Month navigation */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={prevMonth}
                  className="rounded-md p-1.5 transition-colors hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">
                  {months[month]} {year}
                </span>
                <button
                  onClick={nextMonth}
                  className="rounded-md p-1.5 transition-colors hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="mb-1 grid grid-cols-7">
                {days.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((d, i) => {
                  if (!d) return <div key={`empty-${i}`} />
                  const iso = toISO(d)
                  const inRange = isInRange(d)
                  const isStart = isRangeStart(d)
                  const isEnd = isRangeEnd(d)
                  const isToday = toISO(d) === toISO(TODAY())
                  const isSelected =
                    (displayFrom &&
                      iso === displayFrom.toISOString().split("T")[0]) ||
                    (displayTo && iso === displayTo.toISOString().split("T")[0])

                  return (
                    <button
                      key={iso}
                      onClick={() => handleDayClick(d)}
                      className={cn(
                        "h-8 w-full rounded-md text-xs transition-colors",
                        isToday && !isSelected && "font-semibold",
                        isSelected &&
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                        inRange && !isSelected && "bg-primary/10",
                        isStart && "rounded-r-none",
                        isEnd && "rounded-l-none",
                        !inRange && !isSelected && "hover:bg-muted"
                      )}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Manual inputs */}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {labels.from ?? "From"}
                  </label>
                  <Input
                    type="date"
                    value={tempFrom ?? ""}
                    onChange={(e) => setTempFrom(e.target.value || null)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {labels.to ?? "To"}
                  </label>
                  <Input
                    type="date"
                    value={tempTo ?? ""}
                    onChange={(e) => setTempTo(e.target.value || null)}
                    min={tempFrom ?? undefined}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  {labels.clear ?? "Clear"}
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApply}>
                    {labels.apply ?? "Apply"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
