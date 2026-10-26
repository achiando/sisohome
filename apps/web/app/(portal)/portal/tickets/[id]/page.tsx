'use client'

/**
 * Ticket detail (plan-slice-7 §3): the full record + conversation thread.
 * The tenant can only append notes (`PATCH` rejects any other field — the
 * server enforces it, this form never sends lifecycle fields).
 */

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'

import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { UniversalForm } from '@workspace/ui/components/form'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import type { FormSection } from '@workspace/ui/types/components'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PriorityChip, StatusChip } from '@/app/(dashboard)/maintenance/_components/maintenance-status'

import { usePortalApi, type PortalTicket } from '../../../_components/portal-data'

interface TicketRes {
  success: boolean
  ticket: PortalTicket
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export default function PortalTicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [version, setVersion] = useState(0)
  const { data, error, loading } = usePortalApi<TicketRes>(
    `/api/portal/tickets/${id}`,
    version,
  )
  const [values, setValues] = useState<Record<string, unknown>>({ note: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSummary(null)
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleNote = async (v: Record<string, unknown>) => {
    const body = str(v.note).trim()
    if (!body) {
      setErrors({ note: 'Write a message first' })
      return
    }
    if (body.length > 2000) {
      setErrors({ note: 'Keep messages to 2000 characters or fewer' })
      return
    }
    setSummary(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: body }),
      })
      const payload: { success?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}))
      if (res.ok && payload.success) {
        setValues({ note: '' })
        setVersion((n) => n + 1)
        toast.success('Reply added')
        return
      }
      if (res.status === 404) {
        setSummary('This request no longer exists.')
        return
      }
      const message = payload.error ?? 'Could not add your reply.'
      if (message.startsWith('note')) setErrors({ note: message })
      else setSummary(message)
    } catch {
      setSummary('We could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading request..." />
      </div>
    )
  }

  if (error) {
    const notFound = error.toLowerCase().includes('not found')
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>{notFound ? 'Request not found' : 'Something went wrong'}</CardTitle>
            <CardDescription>
              {notFound
                ? 'This request does not exist on your account.'
                : error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/portal/tickets">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to requests
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ticket = data?.ticket
  if (!ticket) return null

  const noteSection: FormSection = {
    id: 'reply',
    title: 'Add a reply',
    columns: 2,
    fields: [
      {
        name: 'note',
        label: 'Message',
        type: 'textarea',
        required: true,
        colSpan: 2,
        placeholder: 'Add details, access instructions, or a follow-up…',
      },
    ],
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/portal/tickets"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> All requests
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {ticket.title}
              </h1>
              <StatusChip status={ticket.status} />
              <PriorityChip priority={ticket.priority} />
            </div>
            <p className="text-sm text-muted-foreground">
              {ticket.property.name}
              {ticket.unit ? ` · ${ticket.unit.label}` : ''} · {ticket.category.toLowerCase()} ·
              reported {formatDate(ticket.reportedAt)}
            </p>
          </div>
        </div>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>
            Replies from the property team appear here. Status changes are managed by them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.description ? (
            <div className="rounded-xl bg-muted px-3.5 py-3 text-sm text-foreground">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your report
              </p>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </div>
          ) : null}

          {ticket.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
          ) : (
            <ul className="space-y-3">
              {ticket.notes.map((note) => (
                <li
                  key={note.id}
                  className={`rounded-xl px-3.5 py-3 text-sm ${
                    note.author === 'tenant'
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-muted-foreground">
                      {note.author === 'tenant' ? 'You' : 'Property team'}
                    </span>
                    <span className="text-muted-foreground">{formatDate(note.createdAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent className="pt-6">
          {summary ? (
            <div className="mb-4">
              <Alert variant="destructive">
                <AlertDescription>{summary}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          <UniversalForm
            title="Add a reply"
            mode="edit"
            variant="standard"
            sections={[noteSection]}
            values={values}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleNote}
            isLoading={submitting}
            primaryLabel="Send reply"
            formClassName="w-full"
            bare
          />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Send className="size-3.5" aria-hidden="true" /> Status and priority stay with the
            property team.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
