type Bucket = { count: number, resetAt: number }

const store = globalThis as unknown as {
  nightlightRequestBuckets?: Map<string, Bucket>
}

const buckets = store.nightlightRequestBuckets ?? new Map<string, Bucket>()
store.nightlightRequestBuckets = buckets

export function assertRequestRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests. Please try again later.',
    })
  }

  current.count += 1
}

export function requestClientKey(event: Parameters<typeof getRequestIP>[0]) {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}
