type Attempt = { count: number, resetAt: number }

const globalStore = globalThis as unknown as {
  nightlightPortalAttempts?: Map<string, Attempt>
}

const attempts = globalStore.nightlightPortalAttempts ?? new Map<string, Attempt>()
globalStore.nightlightPortalAttempts = attempts

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 60

export function assertPortalRateLimit(key: string) {
  const now = Date.now()
  const existing = attempts.get(key)
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  if (existing.count >= MAX_ATTEMPTS) {
    throw createError({ statusCode: 429, statusMessage: 'Te veel verzoeken aan het portaal. Probeer het later opnieuw.' })
  }
  existing.count += 1
}
