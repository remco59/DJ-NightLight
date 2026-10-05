export default defineNuxtPlugin((nuxtApp) => {
  const online = useOnline()
  const sync = () => { online.value = navigator.onLine }
  nuxtApp.hook('app:mounted', () => {
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
  })
})
