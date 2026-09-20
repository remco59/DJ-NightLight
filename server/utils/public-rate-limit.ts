import { consumeFixedWindow, type RateLimitEntry } from './fixed-window-rate-limit'

const globalStore = globalThis as unknown as {
  nightlightPublicAttempts?: Map<string, RateLimitEntry>
}

const attempts = globalStore.nightlightPublicAttempts ?? new Map<string, RateLimitEntry>()
globalStore.nightlightPublicAttempts = attempts

const WINDOW_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

export function assertPublicRateLimit(key: string) {
  const result = consumeFixedWindow(attempts, key, {
    windowMs: WINDOW_MS,
    maxAttempts: MAX_ATTEMPTS,
    maxKeys: 10_000,
  })
  if (!result.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again later.' })
  }
}
