/* TPT School service worker.
 *
 * Purpose: make the app installable and show a friendly offline page when the network is down.
 *
 * What is cached:
 *   - the offline page, icons and manifest (installed up front)
 *   - Next.js build assets under /_next/static/ (immutable, safe to cache)
 *
 * What is never cached:
 *   - page navigations, API responses and anything carrying a session. Those can contain
 *     student or finance data, so they always go to the network. When offline, a navigation
 *     falls back to /offline and nothing else is served from cache.
 *
 * Bump CACHE_VERSION when this file changes so old caches are removed on activate.
 */

const CACHE_VERSION = 'tpt-shell-v1'
const PRECACHE = ['/offline', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Page loads: network first. Never stored. Offline shows the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline').then(r => r || Response.error())),
    )
    return
  }

  // Build assets and icons: cache first. These are content-hashed or static, so they are safe to reuse.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy))
          }
          return response
        })
      }),
    )
  }
  // Everything else (API calls, data) goes straight to the network.
})
