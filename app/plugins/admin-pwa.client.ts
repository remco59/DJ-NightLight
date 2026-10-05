// Installable admin app with offline gig details. The service worker
// (public/admin-sw.js) serves cached gig data when the network is gone; this
// plugin registers it, keeps the cache filled while online, and wipes it when
// the session ends because the cache holds client and fee information.
const SW_URL = '/admin-sw.js'
const WARM_GIG_LIMIT = 15
const GRACE_MS = 24 * 60 * 60 * 1000

type WarmGig = { id: string; startsAt: string | null }

export default defineNuxtPlugin((nuxtApp) => {
  if (!('serviceWorker' in navigator) || !window.location.pathname.startsWith('/admin')) return

  const { loggedIn, user } = useUserSession()
  const registration = navigator.serviceWorker.register(SW_URL, { scope: '/admin' }).catch(() => null)

  async function clearCache() {
    const reg = await registration
    const worker = reg?.active ?? (await navigator.serviceWorker.ready).active
    worker?.postMessage({ type: 'clear-gig-cache' })
  }

  async function warm() {
    const role = user.value?.role
    if (!navigator.onLine || !['owner', 'manager', 'dj'].includes(role as string)) return
    await navigator.serviceWorker.ready
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
      // One page visit's worth of code, so client-side navigation to a gig also works offline.
      if (upcoming[0]) await preloadRouteComponents(`/admin/gigs/${upcoming[0].id}`).catch(() => {})
      await get('/admin/gigs', true)
      for (const gig of upcoming) {
        await get(`/api/admin/gigs/${gig.id}`)
        await get(`/admin/gigs/${gig.id}`, true)
      }
    } catch {
      // Offline or interrupted: the next page load tries again.
    }
  }

  nuxtApp.hook('app:mounted', () => {
    watch(loggedIn, (value) => {
      if (value) void warm()
      else void clearCache()
    }, { immediate: true })
    window.addEventListener('online', () => { if (loggedIn.value) void warm() })
  })
})
