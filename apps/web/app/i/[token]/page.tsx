import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { RouteError } from '@/lib/api-route'
import { resolveIntake, type IntakeContext } from '@/lib/domain/intake'

import { IntakeErrorCard } from '../_components/intake-error-card'
import { IntakeForm } from './intake-form'

/**
 * `/i/<token>` — the public self-onboarding entry (people plan §5). The
 * signed token IS the capability: we resolve it server-side and render
 * minimal property/unit context for the client form to POST with.
 *
 * React `cache()` dedupes the resolve across generateMetadata + render in
 * one request. Invalid token → 404 (notFound); expired or issuer-scope
 * revoked → a friendly card (pages can't set 410 — the JSON API does).
 */

interface IntakePageProps {
  params: Promise<{ token: string }>
}

const resolveCached = cache(resolveIntake)

type PageResolve =
  | { kind: 'ok'; context: IntakeContext }
  | { kind: 'invalid' }
  | { kind: 'unavailable'; message: string }

async function resolvePage(token: string): Promise<PageResolve> {
  try {
    return { kind: 'ok', context: await resolveCached(token) }
  } catch (err) {
    if (err instanceof RouteError && err.status === 404) return { kind: 'invalid' }
    if (err instanceof RouteError && err.status === 410) {
      return { kind: 'unavailable', message: err.message }
    }
    throw err
  }
}

export async function generateMetadata({ params }: IntakePageProps): Promise<Metadata> {
  const { token } = await params
  const resolved = await resolvePage(token)
  return {
    title: resolved.kind === 'ok' ? `Apply — ${resolved.context.property.name}` : 'Apply',
    robots: { index: false, follow: false },
  }
}

export default async function IntakePage({ params }: IntakePageProps) {
  const { token } = await params
  const resolved = await resolvePage(token)

  if (resolved.kind === 'invalid') notFound()
  if (resolved.kind === 'unavailable') {
    return <IntakeErrorCard title="Link unavailable" message={resolved.message} />
  }
  return <IntakeForm token={token} context={resolved.context} />
}
