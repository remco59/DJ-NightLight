/* Service worker for the admin app (scope /admin).
 *
 * Goal: the pages a DJ needs on location stay readable without a connection. It
 * deliberately caches very little:
 *  - hashed /_nuxt assets (cache-first), so a visited page still boots offline;
 *  - a short list of read-only API responses and their pages (network-first, the
 *    cached copy is only used when the network fails): gigs, music wishes,
 *    venues, clients, the dashboard and the agenda.
 * Nothing else under /api is ever cached (no portal links, invoices or settings),
 * and every write goes straight to the network. Queued offline changes live in the
 * app (IndexedDB), not here. Cached data is removed on logout / expired session
 * (see the admin-pwa client plugin), because it holds client and fee information.
 */
const VERSION = 'v2'
const ASSETS = `nl-assets-${VERSION}`
const DATA = `nl-data-${VERSION}`
const OFFLINE_URL = '/admin-offline.html'
const MAX_DATA_ENTRIES = 160

const DATA_API = [
  /^\/api\/admin\/gigs(\/[0-9a-f-]{36})?$/i,
  /^\/api\/admin\/gigs\/[0-9a-f-]{36}\/portal-submission$/i,
  /^\/api\/admin\/venues\/[0-9a-f-]{36}$/i,
  /^\/api\/admin\/clients\/[0-9a-f-]{36}$/i,
  /^\/api\/admin\/dashboard$/i,
  /^\/api\/admin\/calendar\/events$/i,
]
const DATA_PAGES = [
  /^\/admin\/?$/i,
  /^\/admin\/gigs(\/[0-9a-f-]{36})?\/?$/i,
  /^\/admin\/calendar\/?$/i,
  /^\/admin\/venues\/[0-9a-f-]{36}\/?$/i,
  /^\/admin\/clients\/[0-9a-f-]{36}\/?$/i,
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSETS).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([ASSETS, DATA])
    for (const name of await caches.keys()) {
      if (name.startsWith('nl-') && !keep.has(name)) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-cache') event.waitUntil(caches.delete(DATA))
})

async function trim(cache) {
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DATA_ENTRIES))) await cache.delete(key)
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(DATA)
  try {
    const response = await fetch(request)
    if (response.ok && !response.redirected) {
      await cache.put(request.url, response.clone())
      await trim(cache)
    }
    return response
  } catch (error) {
    const cached = await cache.match(request.url)
    if (cached) return cached
    if (fallback) return fallback()
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (DATA_API.some(pattern => pattern.test(url.pathname))) {
    // Keyed on the full URL: a filtered list is only available offline once it was loaded online.
    event.respondWith(networkFirst(request))
    return
  }

  // The warm-up fetches pages with this header so they are stored like a visit.
  const isPage = request.mode === 'navigate' || request.headers.has('x-pwa-warm')
  if (isPage && DATA_PAGES.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request, () => caches.match(OFFLINE_URL)))
    return
  }

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin')) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
  }
})
