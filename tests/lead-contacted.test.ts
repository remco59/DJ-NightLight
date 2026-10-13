import { beforeEach, describe, expect, it, vi } from 'vitest'

let gig: { status: string, deletedAt: Date | null } | undefined
let updated: Record<string, unknown> | null = null
const audits: Array<Record<string, unknown>> = []

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readValidatedBody', async (event: { body: unknown }, parse: (value: unknown) => unknown) => parse(event.body))
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
vi.mock('../server/utils/require-staff', () => ({ requireStaff: async () => ({ id: 'u1', role: 'owner' }) }))
vi.mock('../server/utils/route-params', () => ({ requireUuidParam: () => '11111111-1111-4111-8111-111111111111' }))
vi.mock('../server/utils/audit', () => ({ recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry) } }))
vi.mock('../server/utils/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (gig ? [gig] : []) }) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({ returning: async () => { updated = values; return [{ id: 'g1', ...values }] } }),
      }),
    }),
  },
}))

const handler = (await import('../server/api/admin/gigs/[id]/contacted.post')).default as unknown as (event: { body: unknown }) => Promise<{ gig: { lastContactedAt: Date, followUpAt: Date | null } }>

describe('mark a lead as answered', () => {
  beforeEach(() => {
    gig = { status: 'lead', deletedAt: null }
    updated = null
    audits.length = 0
  })

  it('plans a follow-up in 3 days by default', async () => {
    const { gig: result } = await handler({ body: {} })
    const days = (result.followUpAt!.getTime() - result.lastContactedAt.getTime()) / 86_400_000
    expect(days).toBeCloseTo(3, 5)
    expect(audits[0]).toMatchObject({ action: 'lead_contacted', entityType: 'gig' })
  })

  it('accepts a week or no follow-up at all', async () => {
    const week = await handler({ body: { followUpInDays: 7 } })
    expect((week.gig.followUpAt!.getTime() - week.gig.lastContactedAt.getTime()) / 86_400_000).toBeCloseTo(7, 5)
    const none = await handler({ body: { followUpInDays: null } })
    expect(none.gig.followUpAt).toBeNull()
  })

  it('does not touch updatedAt', async () => {
    await handler({ body: {} })
    expect(updated).not.toHaveProperty('updatedAt')
  })

  it('only works for open leads', async () => {
    gig = { status: 'booked', deletedAt: null }
    await expect(handler({ body: {} })).rejects.toMatchObject({ statusCode: 409 })
    gig = undefined
    await expect(handler({ body: {} })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects nonsense follow-up periods', async () => {
    await expect(handler({ body: { followUpInDays: 0 } })).rejects.toThrow()
    await expect(handler({ body: { followUpInDays: 1000 } })).rejects.toThrow()
  })
})
