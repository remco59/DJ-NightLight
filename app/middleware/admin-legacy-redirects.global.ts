// Pages that moved under Instellingen keep answering on their old URL.
export default defineNuxtRouteMiddleware((to) => {
  const target = legacySettingsPaths[to.path.replace(/\/+$/, '')]
  if (target) return navigateTo({ path: target, query: to.query, hash: to.hash }, { replace: true, redirectCode: 301 })
  if (to.path.replace(/\/+$/, '') === '/admin/settings' && to.query.instagram !== undefined) {
    return navigateTo({ path: '/admin/settings/instagram', query: to.query }, { replace: true })
  }
})
