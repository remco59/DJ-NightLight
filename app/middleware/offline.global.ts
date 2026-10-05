import { worksOffline } from '~~/shared/offline-routes'

// Offline, pages that cannot load their data are replaced by a "Je bent offline"
// page instead of opening empty or half-broken.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || navigator.onLine) return
  if (!to.path.startsWith('/admin') || worksOffline(to.path)) return
  return navigateTo({ path: '/admin/offline', query: { from: to.fullPath } })
})
