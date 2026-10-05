// Admin pages that keep working without a connection: the gig list and gig
// details, served from the service worker cache (public/admin-sw.js). Every
// other admin page needs the network, so offline it shows a "Je bent offline" page.
const offlineRoutes = [/^\/admin\/gigs\/?$/, /^\/admin\/gigs\/[0-9a-f-]{36}\/?$/i, /^\/admin\/offline\/?$/]

export function worksOffline(path: string) {
  return offlineRoutes.some(route => route.test(path))
}
