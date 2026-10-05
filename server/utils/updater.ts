import type { UpdateCheck, UpdateRunState } from '../../shared/system-update'

function updaterConfig() {
  const config = useRuntimeConfig().updater as { url?: string, token?: string } | undefined
  return { url: String(config?.url || '').replace(/\/+$/, ''), token: String(config?.token || '') }
}

export function updaterAvailable() {
  const { url, token } = updaterConfig()
  return Boolean(url && token)
}

export async function updaterRequest<T>(path: string, method: 'GET' | 'POST' = 'GET', timeout = 10_000) {
  const { url, token } = updaterConfig()
  if (!url || !token) {
    throw createError({ statusCode: 409, statusMessage: 'Updates zijn in deze omgeving niet ingeschakeld' })
  }
  try {
    return await $fetch<T>(`${url}${path}`, {
      method,
      timeout,
      headers: { authorization: `Bearer ${token}` },
    })
  } catch (error: unknown) {
    const data = (error as { data?: { error?: unknown } })?.data
    const status = (error as { statusCode?: number })?.statusCode
    if (typeof data?.error === 'string') {
      throw createError({ statusCode: status && status < 500 ? status : 502, statusMessage: data.error })
    }
    throw createError({ statusCode: 502, statusMessage: 'De updater is niet bereikbaar' })
  }
}

export type UpdaterStatus = {
  configured: boolean
  configError: string | null
  branch: string
  current: UpdateCheck['current']
  state: UpdateRunState
  lastCheck: UpdateCheck | null
}

type MaintenanceState = { maintenance: boolean, step: string | null }

const CACHE_MS = 2000
let cached: MaintenanceState & { at: number } = { maintenance: false, step: null, at: 0 }
let inflight: Promise<MaintenanceState> | null = null

/**
 * Whether the updater is rebuilding the stack. Cached briefly so every request
 * does not hit the sidecar; an unreachable updater never locks the site.
 */
export async function maintenanceState(): Promise<MaintenanceState> {
  if (!updaterAvailable()) return { maintenance: false, step: null }
  if (Date.now() - cached.at < CACHE_MS) return { maintenance: cached.maintenance, step: cached.step }
  inflight ||= updaterRequest<MaintenanceState>('/maintenance', 'GET', 1500)
    .then(result => ({ maintenance: Boolean(result.maintenance), step: result.step || null }))
    .catch(() => ({ maintenance: false, step: null }))
    .then((result) => {
      cached = { ...result, at: Date.now() }
      inflight = null
      return result
    })
  return inflight
}

/** Forces the next maintenanceState() call to ask the updater again. */
export function resetMaintenanceCache() {
  cached = { maintenance: false, step: null, at: 0 }
}
