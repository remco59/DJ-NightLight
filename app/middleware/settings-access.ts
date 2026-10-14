import type { StaffRole } from '~~/shared/auth'

// Instellingen is shared by several roles, so each section checks the role itself.
// The API enforces the same rules; this only keeps people off pages that would fail.
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useUserSession()
  const role = user.value?.role as StaffRole | undefined
  const path = to.path.replace(/\/+$/, '')
  if (path === '/admin/settings') return navigateTo(firstSettingsPath(role), { replace: true })
  if (!settingsSectionAllowed(role, path)) return navigateTo(firstSettingsPath(role), { replace: true })
})
