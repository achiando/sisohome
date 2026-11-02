'use client'

/**
 * /calendar — the landlord-attention calendar (plan-roadmap Phase 3): a
 * month grid with date-cell event dots (hand-rolled — no calendar library),
 * an agenda toggle, and the currently-vacant-units panel. Events come from
 * GET /api/calendar, scoped server-side per domain with per-class list
 * gates; every event is click-through to its entity's detail route.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@workspace/ui/components/empty'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type CalendarEventKind =
  | 'VIEWING'
  | 'LEASE_END'
  | 'WORK_ORDER'
  | 'INSPECTION'
  | 'RECURRING'
  | 'VACANT_UNIT'

interface CalendarEvent {
  kind: CalendarEventKind
  id: string
  date: string
  title: string
  propertyId: string
  unitId?: string | null
  href: string
}

interface VacantUnit {
  id: string
  unitRef: string
  label: string
  propertyId: string
  propertyName: string
}

type BadgeVariant = 'info' | 'warning' | 'purple' | 'indigo' | 'success' | 'error'

const KIND_META: Record<CalendarEventKind, { label: string; dot: string; badge: BadgeVariant }> = {
  VIEWING: { label: 'Viewing', dot: 'bg-blue-500', badge: 'info' },
  LEASE_END: { label: 'Lease end', dot: 'bg-amber-500', badge: 'warning' },
  WORK_ORDER: { label: 'Work order', dot: 'bg-purple-500', badge: 'purple' },
  INSPECTION: { label: 'Inspection', dot: 'bg-indigo-500', badge: 'indigo' },
  RECURRING: { label: 'Recurring due', dot: 'bg-emerald-500', badge: 'success' },
  VACANT_UNIT: { label: 'Vacant unit', dot: 'bg-red-500', badge: 'error' },
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Local YYYY-MM-DD (grid cells are the user's wall-clock days). */
function ymd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** "Wed, 05 Nov 2026" — built from the ymd parts, never via Date parsing. */
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Mon-first 6-week grid span covering the anchor month (42 cells). */
function gridSpan(anchor: Date): { from: string; to: string; days: Date[] } {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return { from: ymd(days[0]!), to: ymd(days[41]!), days }
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  return map
}

export default function CalendarPage() {
  const router = useRouter()
  const { hasUiPermission } = useUiPermission()
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [vacantUnits, setVacantUnits] = useState<VacantUnit[]>([])
  const [loading, setLoading] = useState(true)

  const span = useMemo(() => gridSpan(anchor), [anchor])
  const byDate = useMemo(() => groupByDate(events), [events])
  const todayStr = ymd(new Date())
  const monthLabel = anchor.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })

  useEffect(() => {
    let cancelled = false
    // Deferred — react-hooks v7 forbids sync setState in an effect body.
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetch(`/api/calendar?from=${span.from}&to=${span.to}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load calendar')
        }
        const data = await res.json()
        if (!cancelled) {
          setEvents((data.events ?? []) as CalendarEvent[])
          setVacantUnits((data.vacantUnits ?? []) as VacantUnit[])
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load calendar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [span.from, span.to])

  if (!hasUiPermission('property.read')) {
    return (
      <ScopeDenied message="You need the property.read permission to view the calendar. Ask an owner or admin of your organization." />
    )
  }

  const open = (href: string) => router.push(href)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Viewings, lease ends, scheduled jobs and vacancies — the landlord-attention view."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setAnchor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-semibold">{monthLabel}</span>
        <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setAnchor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="text" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={view === 'month' ? 'primary' : 'text'} size="sm" onClick={() => setView('month')}>
            Month
          </Button>
          <Button variant={view === 'agenda' ? 'primary' : 'text'} size="sm" onClick={() => setView('agenda')}>
            Agenda
          </Button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {view === 'month' ? (
            <MonthGrid days={span.days} anchor={anchor} byDate={byDate} todayStr={todayStr} onOpen={open} />
          ) : (
            <Agenda byDate={byDate} onOpen={open} />
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(Object.keys(KIND_META) as CalendarEventKind[]).map((kind) => (
              <span key={kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', KIND_META[kind].dot)} />
                {KIND_META[kind].label}
              </span>
            ))}
          </div>

          <VacantPanel units={vacantUnits} onOpen={open} />
        </div>
      )}
    </div>
  )
}

function MonthGrid({
  days,
  anchor,
  byDate,
  todayStr,
  onOpen,
}: {
  days: Date[]
  anchor: Date
  byDate: Map<string, CalendarEvent[]>
  todayStr: string
  onOpen: (href: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((day) => {
          const key = ymd(day)
          const cellEvents = byDate.get(key) ?? []
          const isOutside = day.getMonth() !== anchor.getMonth() || day.getFullYear() !== anchor.getFullYear()
          const isToday = key === todayStr
          return (
            <div key={key} className={cn('min-h-24 bg-background p-2', isOutside && 'bg-muted/30')}>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                    !isToday && isOutside && 'text-muted-foreground',
                  )}
                >
                  {day.getDate()}
                </span>
                {cellEvents.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{cellEvents.length - 3}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cellEvents.slice(0, 3).map((e) => (
                  <button
                    key={`${e.kind}:${e.id}`}
                    type="button"
                    title={e.title}
                    aria-label={`${KIND_META[e.kind].label}: ${e.title}`}
                    onClick={() => onOpen(e.href)}
                    className={cn('h-2.5 w-2.5 rounded-full transition-transform hover:scale-125', KIND_META[e.kind].dot)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Agenda({
  byDate,
  onOpen,
}: {
  byDate: Map<string, CalendarEvent[]>
  onOpen: (href: string) => void
}) {
  if (byDate.size === 0) {
    return (
      <Empty className="rounded-xl border">
        <EmptyHeader>
          <EmptyTitle>No events in this range</EmptyTitle>
          <EmptyDescription>
            Viewings, lease ends, scheduled jobs and vacancies will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-5">
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date} className="space-y-2">
          <Text variant="label">{dayLabel(date)}</Text>
          <div className="space-y-2">
            {list.map((e) => (
              <button
                key={`${e.kind}:${e.id}`}
                type="button"
                onClick={() => onOpen(e.href)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <Badge variant={KIND_META[e.kind].badge} size="sm">
                  {KIND_META[e.kind].label}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function VacantPanel({ units, onOpen }: { units: VacantUnit[]; onOpen: (href: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Home className="size-4 text-muted-foreground" aria-hidden />
        <Text variant="label">Vacant units ({units.length})</Text>
      </div>
      {units.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No vacant units right now.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <Card key={u.id} variant="interactive" onClick={() => onOpen(`/portfolio/${u.propertyId}/units`)}>
              <CardContent className="p-4">
                <p className="text-sm font-medium">
                  {u.unitRef}
                  {u.label !== u.unitRef ? ` — ${u.label}` : ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.propertyName}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
