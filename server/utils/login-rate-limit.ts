import { consumeFixedWindow, type RateLimitEntry } from './fixed-window-rate-limit'

const globalRateLimit = globalThis as unknown as {
  nightlightLoginAttempts?: Map<string, RateLimitEntry>
}

const attempts = globalRateLimit.nightlightLoginAttempts ?? new Map<string, RateLimitEntry>()
globalRateLimit.nightlightLoginAttempts = attempts

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export function assertLoginRateLimit(key: string) {
  const result = consumeFixedWindow(attempts, key, {
    windowMs: WINDOW_MS,
    maxAttempts: MAX_ATTEMPTS,
    maxKeys: 10_000,
  })
  if (!result.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Try again later.',
    })
  }
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key)
}
