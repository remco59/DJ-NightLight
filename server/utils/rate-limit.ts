// Derived from the auto-imported helpers so it matches the h3 version Nitro uses
type RateLimitEvent = Parameters<typeof setResponseHeader>[0]

/**
 * Central rate-limit configuration. Limits are per key (usually per client IP) and
 * kept in process memory, which is fine for the single web instance we run. If the
 * app is scaled horizontally, move the buckets to a shared store.
 */
export const RATE_LIMITS = {
  // Brute-force protection on authentication
  // Per client IP across all emails, so rotating the email does not reset the limit
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000, message: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
  login: { limit: 5, windowMs: 15 * 60 * 1000, message: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
  bootstrap: { limit: 5, windowMs: 15 * 60 * 1000, message: 'Te veel verzoeken. Probeer het later opnieuw.' },
  // Public contact form
  public: { limit: 5, windowMs: 60 * 60 * 1000, message: 'Te veel verzoeken. Probeer het later opnieuw.' },
  // Client portal (magic-link URLs)
  portal: { limit: 60, windowMs: 10 * 60 * 1000, message: 'Te veel verzoeken aan het portaal. Probeer het later opnieuw.' },
  // Baseline per client and API area for public, portal and auth routes
  baseline: { limit: 300, windowMs: 15 * 60 * 1000, message: 'Te veel verzoeken. Probeer het later opnieuw.' },
} as const

export type RateLimitName = keyof typeof RATE_LIMITS

type Bucket = { count: number, resetAt: number }

const store = globalThis as unknown as {
  nightlightRateBuckets?: Map<string, Bucket>
}

const buckets = store.nightlightRateBuckets ?? new Map<string, Bucket>()
store.nightlightRateBuckets = buckets

let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Throws 429 with a `Retry-After` header once `key` exceeds the limit named `name`. */
export function assertRateLimit(event: RateLimitEvent, name: RateLimitName, key: string, now = Date.now()) {
  const config = RATE_LIMITS[name]
  const bucketKey = `${name}:${key}`
  sweep(now)

  const current = buckets.get(bucketKey)
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + config.windowMs })
    return
  }

  if (current.count >= config.limit) {
    setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil((current.resetAt - now) / 1000)))
    throw createError({ statusCode: 429, statusMessage: config.message })
  }

  current.count += 1
}

export function clearRateLimit(name: RateLimitName, key: string) {
  buckets.delete(`${name}:${key}`)
}

export function requestClientKey(event: RateLimitEvent) {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear()
}
