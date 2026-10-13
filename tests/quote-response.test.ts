import { beforeEach, describe, expect, it, vi } from 'vitest'

type QuoteRow = { id: string, status: string, validUntil: string, quoteNumber: string, totalCents: number, currency: string, sentAt: Date }
let openQuote: QuoteRow | undefined
let access: { gigId: string, title: string, status: string } | null
let updateResult: Array<Record<string, unknown>> = [{ id: 'q1', acceptedAt: new Date('2026-11-02T10:00:00.000Z') }]
const updates: Array<Record<string, unknown>> = []
const audits: Array<Record<string, unknown>> = []
const notifications: Array<{ kind: string, payload: Record<string, unknown>, suffix?: string }> = []

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRouterParam', () => 'a'.repeat(43))
vi.stubGlobal('getRequestIP', () => '203.0.113.5')
vi.stubGlobal('setResponseHeader', () => undefined)
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
let body: unknown = {}
vi.stubGlobal('readBody', async () => body)
vi.mock('../server/utils/portal-access', () => ({ resolvePortalAccess: async () => access }))
vi.mock('../server/utils/owner-notifications', () => ({
  queueOwnerNotification: async (kind: string, _id: string, payload: Record<string, unknown>, suffix?: string) => { notifications.push({ kind, payload, suffix }) },
}))
vi.mock('../shared/dates', () => ({ todayInAmsterdam: () => '2026-11-02' }))
vi.mock('../server/utils/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => (openQuote ? [openQuote] : []) }) }) }) }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: () => ({ returning: async () => { updates.push(values); return updateResult } }) }) }),
    insert: () => ({ values: async (row: Record<string, unknown>) => { audits.push(row) } }),
  },
}))

const accept = (await import('../server/api/client/portal/[token]/quote-accept.post')).default as unknown as (event: object) => Promise<{ ok: boolean }>
const decline = (await import('../server/api/client/portal/[token]/quote-decline.post')).default as unknown as (event: object) => Promise<{ ok: boolean }>
const { resetRateLimits } = await import('../server/utils/rate-limit')

describe('client accepts a quote', () => {
  beforeEach(() => {
    resetRateLimits()
    openQuote = { id: 'q1', status: 'sent', validUntil: '2026-11-10', quoteNumber: 'OFF-2026-0001', totalCents: 121000, currency: 'EUR', sentAt: new Date() }
    access = { gigId: 'g1', title: 'Bruiloft', status: 'lead' }
    updateResult = [{ id: 'q1', acceptedAt: new Date('2026-11-02T10:00:00.000Z') }]
    updates.length = 0
    audits.length = 0
    notifications.length = 0
    body = { acceptedName: 'Sanne de Vries', agree: true }
  })

  it('records who accepted and tells the owner', async () => {
    expect((await accept({})).ok).toBe(true)
    expect(updates[0]).toMatchObject({ status: 'accepted', acceptedName: 'Sanne de Vries' })
    expect(String(updates[0]!.acceptedIpHash)).toMatch(/^[0-9a-f]{64}$/)
    expect(audits[0]).toMatchObject({ action: 'quote_accepted', entityId: 'g1' })
    expect(notifications[0]).toMatchObject({ kind: 'quote_response', payload: { outcome: 'accepted', acceptedName: 'Sanne de Vries', totalCents: 121000 }, suffix: 'q1:accepted' })
  })

  it('never stores the raw IP address', async () => {
    await accept({})
    expect(JSON.stringify(updates)).not.toContain('203.0.113.5')
  })

  it('refuses without the tick or a name', async () => {
    body = { acceptedName: 'Sanne', agree: false }
    await expect(accept({})).rejects.toMatchObject({ statusCode: 422 })
    body = { acceptedName: '', agree: true }
    await expect(accept({})).rejects.toMatchObject({ statusCode: 422 })
    expect(updates).toHaveLength(0)
  })

  it('refuses an expired quote', async () => {
    openQuote!.validUntil = '2026-11-01'
    await expect(accept({})).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('verlopen') })
    expect(updates).toHaveLength(0)
  })

  it('refuses when no quote is open or someone answered first', async () => {
    openQuote = undefined
    await expect(accept({})).rejects.toMatchObject({ statusCode: 409 })
    openQuote = { id: 'q1', status: 'sent', validUntil: '2026-11-10', quoteNumber: 'X', totalCents: 1, currency: 'EUR', sentAt: new Date() }
    updateResult = []
    await expect(accept({})).rejects.toMatchObject({ statusCode: 409 })
    expect(notifications).toHaveLength(0)
  })

  it('refuses for a cancelled gig and an invalid link', async () => {
    access = { gigId: 'g1', title: 'X', status: 'cancelled' }
    await expect(accept({})).rejects.toMatchObject({ statusCode: 409 })
    access = null
    await expect(accept({})).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('client declines a quote', () => {
  beforeEach(() => {
    resetRateLimits()
    openQuote = { id: 'q1', status: 'sent', validUntil: '2026-11-10', quoteNumber: 'OFF-2026-0001', totalCents: 121000, currency: 'EUR', sentAt: new Date() }
    access = { gigId: 'g1', title: 'Bruiloft', status: 'lead' }
    updateResult = [{ id: 'q1' }]
    updates.length = 0
    audits.length = 0
    notifications.length = 0
  })

  it('stores the reason and tells the owner', async () => {
    body = { reason: 'Te duur' }
    expect((await decline({})).ok).toBe(true)
    expect(updates[0]).toMatchObject({ status: 'declined', declineReason: 'Te duur' })
    expect(notifications[0]).toMatchObject({ kind: 'quote_response', payload: { outcome: 'declined', reason: 'Te duur' }, suffix: 'q1:declined' })
    expect(audits[0]).toMatchObject({ action: 'quote_declined', metadata: { hasReason: true } })
  })

  it('works without a reason and without a body', async () => {
    body = undefined
    expect((await decline({})).ok).toBe(true)
    expect(updates[0]).toMatchObject({ declineReason: null })
  })

  it('refuses when no quote is open', async () => {
    openQuote = undefined
    await expect(decline({})).rejects.toMatchObject({ statusCode: 409 })
  })
})
