export type RateLimitEntry = {
  count: number
  resetAt: number
}

export function consumeFixedWindow(
  store: Map<string, RateLimitEntry>,
  key: string,
  options: {
    windowMs: number
    maxAttempts: number
    maxKeys?: number
    now?: number
  },
) {
  const now = options.now ?? Date.now()
  const maxKeys = options.maxKeys ?? 10_000

  if (store.size >= maxKeys) {
    for (const [candidate, entry] of store) {
      if (entry.resetAt <= now) store.delete(candidate)
    }
    while (store.size >= maxKeys) {
      const oldest = store.keys().next().value
      if (!oldest) break
      store.delete(oldest)
    }
  }

  const existing = store.get(key)
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: Math.max(0, options.maxAttempts - 1), resetAt: now + options.windowMs }
  }

  if (existing.count >= options.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, options.maxAttempts - existing.count),
    resetAt: existing.resetAt,
  }
}
