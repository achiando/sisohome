'use client'

/**
 * Notification bell — the in-app channel for job + domain alerts (payment
 * claims, lease expiry, cron summaries). Fetches the caller's own rows
 * (`GET /api/notifications`, already user+org scoped server-side), shows an
 * unread badge, marks items read on click and follows `link`.
 *
 * Rendered twice by design (sidebar header on desktop, app bar on mobile) —
 * only one is visible at a time, so two lightweight fetches are fine.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Bell, CheckCheck } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

import { formatRelativeDay } from '@/app/(dashboard)/_components/domain/format'

interface NotifRow {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

interface NotifList {
  unread: number
  rows: NotifRow[]
}

export function NotificationBell() {
  const router = useRouter()
  const [rows, setRows] = useState<NotifRow[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<NotifList>) : null))
      .then((d) => {
        if (d) {
          setRows(d.rows ?? [])
          setUnread(d.unread ?? 0)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const openItem = (n: NotifRow) => {
    setOpen(false)
    if (!n.readAt) {
      fetch(`/api/notifications/${n.id}`, { method: 'PATCH', credentials: 'include' })
        .then(load)
        .catch(() => {})
    }
    if (n.link) router.push(n.link)
  }

  const markAll = () => {
    fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
      .then(load)
      .catch(() => {})
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          className="relative shrink-0"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 min-w-0 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <Button variant="text" size="sm" className="h-auto p-0 text-xs text-primary" onClick={markAll}>
              <CheckCheck className="mr-1 size-3" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rows.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          rows.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => openItem(n)}
              className="flex flex-col items-start gap-0.5 py-2 data-[disabled]:opacity-100"
            >
              <span className="flex w-full items-start gap-2">
                {!n.readAt && (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                )}
                <span
                  className={`text-sm leading-snug ${n.readAt ? 'font-normal text-muted-foreground' : 'font-medium text-foreground'}`}
                >
                  {n.title}
                </span>
              </span>
              {n.body && (
                <span className="line-clamp-2 pl-3 text-xs leading-snug text-muted-foreground">
                  {n.body}
                </span>
              )}
              <span className="pl-3 text-[11px] text-muted-foreground/80">
                {formatRelativeDay(n.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
