// Old links used /admin/settings#integrations; the server never sees the anchor, so map it in the browser.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const router = useRouter()
    const route = router.currentRoute.value
    if (!route.path.startsWith('/admin/settings')) return
    const target = legacySettingsHashes[window.location.hash.replace('#', '')]
    if (target && target !== route.path) void router.replace({ path: target, query: route.query })
  })
})
