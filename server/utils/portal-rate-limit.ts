import { consumeFixedWindow, type RateLimitEntry } from './fixed-window-rate-limit'

const globalStore = globalThis as unknown as {
  nightlightPortalAttempts?: Map<string, RateLimitEntry>
}

const attempts = globalStore.nightlightPortalAttempts ?? new Map<string, RateLimitEntry>()
globalStore.nightlightPortalAttempts = attempts

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 60

export function assertPortalRateLimit(key: string) {
  const result = consumeFixedWindow(attempts, key, {
    windowMs: WINDOW_MS,
    maxAttempts: MAX_ATTEMPTS,
    maxKeys: 25_000,
  })
  if (!result.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many portal requests. Please try again later.' })
  }
}
