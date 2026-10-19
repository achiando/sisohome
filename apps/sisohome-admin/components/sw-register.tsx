'use client'

import { useEffect } from 'react'

/**
 * Service worker registration.
 *
 * - Production: registers /sw.js (network pass-through; see public/sw.js).
 * - Development: unregisters any existing workers — browsers keep polling
 *   stale registrations from earlier sessions and spam the dev log with
 *   /sw.js 404s (or worse, serve an old cached shell).
 */
export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {})
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
