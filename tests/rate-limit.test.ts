import { beforeEach, describe, expect, it, vi } from 'vitest'

let headers: Record<string, string> = {}
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: string) => { headers[name] = value })
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
vi.stubGlobal('getRequestIP', () => '203.0.113.9')

const { assertRateLimit, clearRateLimit, resetRateLimits, RATE_LIMITS } = await import('../server/utils/rate-limit')
const event = {} as never

describe('rate limiting', () => {
  beforeEach(() => {
    resetRateLimits()
    headers = {}
  })

  it('allows requests up to the limit and then returns 429 with Retry-After', () => {
    const { limit, windowMs } = RATE_LIMITS.login
    const now = 1_000_000
    for (let i = 0; i < limit; i++) assertRateLimit(event, 'login', 'ip:a', now)

    expect(() => assertRateLimit(event, 'login', 'ip:a', now + 1000)).toThrowError(expect.objectContaining({ statusCode: 429 }))
    expect(headers['Retry-After']).toBe(String(Math.ceil((windowMs - 1000) / 1000)))
  })

  it('keeps separate buckets per key and per limit name', () => {
    const now = 1_000_000
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) assertRateLimit(event, 'login', 'ip:a', now)

    expect(() => assertRateLimit(event, 'login', 'ip:b', now)).not.toThrow()
    expect(() => assertRateLimit(event, 'public', 'ip:a', now)).not.toThrow()
  })

  it('resets after the window has passed', () => {
    const now = 1_000_000
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) assertRateLimit(event, 'login', 'ip:a', now)

    expect(() => assertRateLimit(event, 'login', 'ip:a', now + RATE_LIMITS.login.windowMs + 1)).not.toThrow()
  })

  it('can clear a bucket (successful login)', () => {
    const now = 1_000_000
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) assertRateLimit(event, 'login', 'ip:a', now)
    clearRateLimit('login', 'ip:a')

    expect(() => assertRateLimit(event, 'login', 'ip:a', now)).not.toThrow()
  })
})
