/* Service worker for the admin app (scope /admin).
 *
 * Goal: gig details stay readable without a connection. It deliberately caches
 * very little:
 *  - hashed /_nuxt assets (cache-first), so a visited page still boots offline;
 *  - the gig list, gig details and gig pages (network-first, cached copy only
 *    used when the network fails).
 * Nothing else under /api is ever cached, and every write goes straight to the
 * network. Cached gig data is removed on logout / expired session (see the
 * admin-pwa client plugin), because it holds client and fee information.
 */
const VERSION = 'v1'
const ASSETS = `nl-assets-${VERSION}`
const DATA = `nl-gigs-${VERSION}`
const OFFLINE_URL = '/admin-offline.html'
const MAX_DATA_ENTRIES = 80

const GIG_API = /^\/api\/admin\/gigs(\/[0-9a-f-]{36})?$/i
const GIG_PAGE = /^\/admin\/gigs(\/[0-9a-f-]{36})?\/?$/i

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
  if (event.data?.type === 'clear-gig-cache') event.waitUntil(caches.delete(DATA))
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

  if (GIG_API.test(url.pathname)) {
    // Keyed on the full URL: a filtered list is only available offline once it was loaded online.
    event.respondWith(networkFirst(request))
    return
  }

  // The warm-up fetches pages with this header so they are stored like a visit.
  const isPage = request.mode === 'navigate' || request.headers.has('x-pwa-warm')
  if (isPage && GIG_PAGE.test(url.pathname)) {
    event.respondWith(networkFirst(request, () => caches.match(OFFLINE_URL)))
    return
  }

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin')) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
  }
})
