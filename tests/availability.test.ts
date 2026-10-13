import { beforeEach, describe, expect, it, vi } from 'vitest'

let rows: Array<{ startsAt: Date, endsAt: Date | null, loadInAt: Date | null }> = []
const headers: Record<string, string> = {}

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getValidatedQuery', async (event: { query: unknown }, parse: (value: unknown) => unknown) => parse(event.query))
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: string) => { headers[name] = value })
vi.stubGlobal('getRequestIP', () => '203.0.113.20')
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
vi.mock('../server/utils/db', () => ({
  db: { select: () => ({ from: () => ({ where: async () => rows }) }) },
}))

const handler = (await import('../server/api/public/availability.get')).default as unknown as (event: { query: unknown }) => Promise<{ date: string, available: boolean }>
const { resetRateLimits } = await import('../server/utils/rate-limit')

describe('public availability', () => {
  beforeEach(() => {
    rows = []
    resetRateLimits()
  })

  it('is available when nothing is booked', async () => {
    expect(await handler({ query: { date: '2026-07-15' } })).toEqual({ date: '2026-07-15', available: true })
  })

  it('is taken when a booked gig starts that day', async () => {
    rows = [{ startsAt: new Date('2026-07-15T18:00:00.000Z'), endsAt: null, loadInAt: null }]
    expect((await handler({ query: { date: '2026-07-15' } })).available).toBe(false)
  })

  it('stays available the day after an evening that runs past midnight', async () => {
    rows = [{ startsAt: new Date('2026-07-15T20:00:00.000Z'), endsAt: new Date('2026-07-16T02:00:00.000Z'), loadInAt: null }]
    expect((await handler({ query: { date: '2026-07-16' } })).available).toBe(true)
  })

  it('rejects malformed dates', async () => {
    await expect(handler({ query: { date: 'morgen' } })).rejects.toThrow()
    await expect(handler({ query: { date: '2026-02-30' } })).rejects.toThrow()
  })

  it('is never cached and reveals nothing but the answer', async () => {
    const result = await handler({ query: { date: '2026-07-15' } })
    expect(Object.keys(result).sort()).toEqual(['available', 'date'])
    expect(headers['Cache-Control']).toBe('no-store')
  })

  it('is rate limited', async () => {
    for (let i = 0; i < 60; i++) await handler({ query: { date: '2026-07-15' } })
    await expect(handler({ query: { date: '2026-07-15' } })).rejects.toMatchObject({ statusCode: 429 })
  })
})
