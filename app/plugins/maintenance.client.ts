import { MAINTENANCE_HEADER } from '~~/shared/system-update'

// When the site goes into maintenance while a page is already open, requests
// start answering 503 + the maintenance header. Reload so the server serves the
// maintenance page, which in turn reloads once the update is done. Hooks the
// browser fetch because $fetch/useFetch (ofetch) resolve it at call time.
export default defineNuxtPlugin(() => {
  const browserFetch = window.fetch.bind(window)
  let reloading = false
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await browserFetch(...args)
    if (!reloading && response.status === 503 && response.headers.get(MAINTENANCE_HEADER)) {
      reloading = true
      window.location.reload()
    }
    return response
  }
})
