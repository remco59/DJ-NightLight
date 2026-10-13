import { monthGridRange } from '~/utils/calendar-range'

// Installable admin app that keeps working offline. The service worker
// (public/admin-sw.js) serves cached data when the network is gone; this plugin
// registers it, keeps the cache filled while online, sends the changes that were
// queued offline (see useOfflineOutbox), and wipes the cache when the session ends
// because it holds client and fee information.
const SW_URL = '/admin-sw.js'
const WARM_GIG_LIMIT = 15
const WARM_BATCH = 3
const GRACE_MS = 24 * 60 * 60 * 1000

type WarmGig = { id: string; startsAt: string | null }
type GigDetail = { gig?: { venueId?: string | null; clientId?: string | null } }

export default defineNuxtPlugin((nuxtApp) => {
  if (!('serviceWorker' in navigator) || !window.location.pathname.startsWith('/admin')) return

  const { loggedIn, user } = useUserSession()
  const outbox = useOfflineOutbox()
  const registration = navigator.serviceWorker.register(SW_URL, { scope: '/admin' }).catch(() => null)

  async function clearCache() {
    const reg = await registration
    const worker = reg?.active ?? (await navigator.serviceWorker.ready).active
    worker?.postMessage({ type: 'clear-cache' })
  }

  async function inBatches<T>(items: T[], task: (item: T) => Promise<unknown>) {
    for (let i = 0; i < items.length; i += WARM_BATCH) await Promise.all(items.slice(i, i + WARM_BATCH).map(task))
  }

  async function warm() {
    const role = user.value?.role
    if (!navigator.onLine || !['owner', 'manager', 'dj'].includes(role as string)) return
    const manager = role === 'owner' || role === 'manager'
    await navigator.serviceWorker.ready
    // Page requests carry a header so the service worker stores them like a visit.
    const get = (url: string, page = false) => fetch(url, { credentials: 'same-origin', headers: page ? { 'x-pwa-warm': '1' } : undefined })
    try {
      const list = await get('/api/admin/gigs?sort=date_desc')
      if (!list.ok) return
      const { gigs } = await list.json() as { gigs: WarmGig[] }
      const since = Date.now() - GRACE_MS
      const upcoming = gigs
        .filter(gig => gig.startsAt && new Date(gig.startsAt).getTime() >= since)
        .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
        .slice(0, WARM_GIG_LIMIT)

      // One page visit's worth of code per page type, so client-side navigation works offline too.
      const routes = ['/admin', '/admin/calendar']
      if (upcoming[0]) routes.push(`/admin/gigs/${upcoming[0].id}`)
      await Promise.all(routes.map(route => preloadRouteComponents(route).catch(() => {})))

      await get('/admin/gigs', true)
      await get('/api/admin/dashboard')
      await get('/admin', true)
      const { start, end } = monthGridRange(new Date())
      await get(`/api/admin/calendar/events?${new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })}`)
      await get('/admin/calendar', true)

      const venues = new Set<string>()
      const clients = new Set<string>()
      await inBatches(upcoming, async (gig) => {
        const detail = await get(`/api/admin/gigs/${gig.id}`)
        await get(`/admin/gigs/${gig.id}`, true)
        await get(`/api/admin/gigs/${gig.id}/portal-submission`)
        const { gig: info } = detail.ok ? await detail.json() as GigDetail : {} as GigDetail
        if (info?.venueId) venues.add(info.venueId)
        if (manager && info?.clientId) clients.add(info.clientId)
      })

      const firstVenue = [...venues][0]
      const firstClient = [...clients][0]
      if (firstVenue) await preloadRouteComponents(`/admin/venues/${firstVenue}`).catch(() => {})
      if (firstClient) await preloadRouteComponents(`/admin/clients/${firstClient}`).catch(() => {})
      await inBatches([...venues], async (id) => { await get(`/api/admin/venues/${id}`); await get(`/admin/venues/${id}`, true) })
      await inBatches([...clients], async (id) => { await get(`/api/admin/clients/${id}`); await get(`/admin/clients/${id}`, true) })
    } catch {
      // Offline or interrupted: the next page load tries again.
    }
  }

  // Send what was queued offline first, so the cache is warmed with the result.
  async function sync() {
    await outbox.flush().catch(() => 0)
    await warm()
  }

  nuxtApp.hook('app:mounted', () => {
    void outbox.load()
    watch(loggedIn, (value) => {
      if (value) void sync()
      else void clearCache()
    }, { immediate: true })
    window.addEventListener('online', () => { if (loggedIn.value) void sync() })
  })
})
