/**
 * SisoHome service worker — v1 (network pass-through).
 *
 * Why this exists: the app manifest is already PWA-complete (standalone,
 * icons, shortcuts) and browsers with a prior registration keep polling
 * /sw.js — without this file every poll was a 404.
 *
 * Deliberately does NOT cache: API responses carry auth/session state and
 * HTML must never go stale. Offline caching arrives with the dedicated
 * PWA increment (see the pwa skill) using explicit cache policies.
 */
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Same-origin GETs go to the network (identical to the default — the
  // handler exists for installability; no cache layers involved).
  event.respondWith(fetch(request))
})
