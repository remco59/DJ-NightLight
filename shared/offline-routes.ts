// Admin pages that keep working without a connection: the dashboard, gigs (list
// and details), the agenda, and the venue and client pages. They are served from
// the service worker cache (public/admin-sw.js). Every other admin page needs the
// network, so offline it shows a "Je bent offline" page.
const id = '[0-9a-f-]{36}'
const offlineRoutes = [
  /^\/admin\/?$/,
  /^\/admin\/gigs\/?$/,
  new RegExp(`^/admin/gigs/${id}/?$`, 'i'),
  /^\/admin\/calendar\/?$/,
  new RegExp(`^/admin/venues/${id}/?$`, 'i'),
  new RegExp(`^/admin/clients/${id}/?$`, 'i'),
  /^\/admin\/offline\/?$/,
]

export function worksOffline(path: string) {
  return offlineRoutes.some(route => route.test(path))
}
