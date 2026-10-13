import { beforeEach, describe, expect, it, vi } from 'vitest'

const stored = new Date('2026-10-01T10:00:00.000Z')
let query: Record<string, string> = {}
let updates = 0

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readValidatedBody', async (event: { body: unknown }, parse: (value: unknown) => unknown) => parse(event.body))
vi.stubGlobal('getQuery', () => query)
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
vi.mock('../server/utils/require-staff', () => ({ requireStaff: async () => ({ id: 'u1', role: 'owner' }) }))
vi.mock('../server/utils/route-params', () => ({ requireUuidParam: () => '11111111-1111-4111-8111-111111111111' }))
vi.mock('../server/utils/audit', () => ({ recordAudit: async () => undefined }))
vi.mock('../server/utils/calendar-sync', () => ({ queueCalendarSync: async () => undefined }))
vi.mock('../server/utils/email-automation', () => ({ queueGigEmail: async () => undefined }))
vi.mock('../server/utils/gig-assignee', () => ({ validateGigAssignee: async () => null }))

const row = { id: 'g1', status: 'lead', assignedUserId: null, updatedAt: stored }
const selectChain = { from: () => ({ where: () => ({ limit: () => Object.assign(Promise.resolve([row]), { for: async () => [row] }) }) }) }
const tx = {
  select: () => selectChain,
  update: () => ({ set: () => ({ where: () => ({ returning: async () => { updates++; return [{ ...row, updatedAt: new Date() }] } }) }) }),
  delete: () => ({ where: async () => undefined }),
  insert: () => ({ values: async () => undefined }),
}
vi.mock('../server/utils/db', () => ({
  db: { select: () => selectChain, transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
}))

const handler = (await import('../server/api/admin/gigs/[id].put')).default as unknown as (event: { body: unknown }) => Promise<unknown>
const body = { title: 'Feest', status: 'lead', currency: 'EUR', publicVisibility: false, contacts: [], timeline: [] }

describe('gig edit version check', () => {
  beforeEach(() => { query = {}; updates = 0 })

  it('saves when the gig is unchanged since the form was loaded', async () => {
    query = { version: stored.toISOString() }
    await handler({ body })
    expect(updates).toBe(1)
  })

  it('refuses with 409 when the gig changed in the meantime', async () => {
    query = { version: '2026-09-30T10:00:00.000Z' }
    await expect(handler({ body })).rejects.toMatchObject({ statusCode: 409 })
    expect(updates).toBe(0)
  })

  it('still saves without a version (older clients)', async () => {
    await handler({ body })
    expect(updates).toBe(1)
  })

  it('rejects a version that is not a date', async () => {
    query = { version: 'nope' }
    await expect(handler({ body })).rejects.toMatchObject({ statusCode: 400 })
  })
})
