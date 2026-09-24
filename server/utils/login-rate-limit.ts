type Attempt = {
  count: number
  resetAt: number
}

const globalRateLimit = globalThis as unknown as {
  nightlightLoginAttempts?: Map<string, Attempt>
}

const attempts = globalRateLimit.nightlightLoginAttempts ?? new Map<string, Attempt>()
globalRateLimit.nightlightLoginAttempts = attempts

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export function assertLoginRateLimit(key: string) {
  const now = Date.now()
  const existing = attempts.get(key)

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  if (existing.count >= MAX_ATTEMPTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Te veel inlogpogingen. Probeer het later opnieuw.',
    })
  }

  existing.count += 1
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key)
}
