import { describe, expect, it } from 'vitest'
import { consumeFixedWindow, type RateLimitEntry } from '../server/utils/fixed-window-rate-limit'

describe('fixed-window rate limiting', () => {
  it('allows requests until the configured limit and then blocks', () => {
    const store = new Map<string, RateLimitEntry>()
    const options = { windowMs: 1000, maxAttempts: 2, now: 100 }
    expect(consumeFixedWindow(store, 'a', options).allowed).toBe(true)
    expect(consumeFixedWindow(store, 'a', options).allowed).toBe(true)
    expect(consumeFixedWindow(store, 'a', options).allowed).toBe(false)
  })

  it('resets an expired window', () => {
    const store = new Map<string, RateLimitEntry>([['a', { count: 99, resetAt: 50 }]])
    expect(consumeFixedWindow(store, 'a', { windowMs: 1000, maxAttempts: 2, now: 100 }).allowed).toBe(true)
    expect(store.get('a')?.count).toBe(1)
  })

  it('bounds the number of tracked keys', () => {
    const store = new Map<string, RateLimitEntry>([
      ['old-1', { count: 1, resetAt: 50 }],
      ['old-2', { count: 1, resetAt: 50 }],
      ['active', { count: 1, resetAt: 5000 }],
    ])
    consumeFixedWindow(store, 'new', { windowMs: 1000, maxAttempts: 5, maxKeys: 3, now: 100 })
    expect(store.size).toBeLessThanOrEqual(3)
    expect(store.has('new')).toBe(true)
    expect(store.has('old-1')).toBe(false)
  })
})
