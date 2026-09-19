type Attempt = { count: number, resetAt: number }

const globalStore = globalThis as unknown as {
  nightlightPublicAttempts?: Map<string, Attempt>
}

const attempts = globalStore.nightlightPublicAttempts ?? new Map<string, Attempt>()
globalStore.nightlightPublicAttempts = attempts

const WINDOW_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

export function assertPublicRateLimit(key: string) {
  const now = Date.now()
  const existing = attempts.get(key)

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  if (existing.count >= MAX_ATTEMPTS) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again later.' })
  }

  existing.count += 1
}
