import { beforeEach, describe, expect, it, vi } from 'vitest'

let gigExists = true
let inserted: Record<string, unknown> | null = null
const audits: Array<Record<string, unknown>> = []

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
let body: unknown = {}
vi.stubGlobal('readBody', async () => body)
vi.mock('../server/utils/require-staff', () => ({ requireStaff: async () => ({ id: 'u1', role: 'owner' }) }))
vi.mock('../server/utils/audit', () => ({ recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry) } }))
vi.mock('../server/utils/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (gigExists ? [{ id: 'g1' }] : []) }) }) }),
    insert: () => ({ values: (values: Record<string, unknown>) => ({ returning: async () => { inserted = values; return [{ id: 'x1', ...values }] } }) }),
  },
}))

const create = (await import('../server/api/admin/expenses/index.post')).default as unknown as (event: { node: { res: { statusCode: number } } }) => Promise<{ expense: Record<string, unknown> }>
const event = { node: { res: { statusCode: 200 } } }
const gigId = '11111111-1111-4111-8111-111111111111'

describe('registering costs and kilometres', () => {
  beforeEach(() => {
    gigExists = true
    inserted = null
    audits.length = 0
    event.node.res.statusCode = 200
  })

  it('stores a cost as entered', async () => {
    body = { kind: 'cost', gigId, spentOn: '2026-10-01', description: 'Lichtset', category: 'huur', amountCents: 12100, vatCents: 2100 }
    const { expense } = await create(event)
    expect(expense).toMatchObject({ kind: 'cost', amountCents: 12100, vatCents: 2100, gigId, createdByUserId: 'u1' })
    expect(event.node.res.statusCode).toBe(201)
    expect(audits[0]).toMatchObject({ entityType: 'expense', action: 'created' })
  })

  it('works the trip amount out on the server and keeps the rate', async () => {
    body = { kind: 'mileage', spentOn: '2026-10-01', kilometers: 42, kmRateCents: 23, amountCents: 999999 }
    const { expense } = await create(event)
    expect(expense).toMatchObject({ kind: 'mileage', amountCents: 966, vatCents: 0, kilometers: '42.0', kmRateCents: 23, category: 'kilometers', description: 'Kilometers', gigId: null })
  })

  it('refuses invalid input without touching the database', async () => {
    body = { kind: 'cost', spentOn: '2026-10-01', description: 'X', category: 'huur', amountCents: 100, vatCents: 500 }
    await expect(create(event)).rejects.toMatchObject({ statusCode: 422 })
    body = { kind: 'mileage', spentOn: '2026-10-01', kilometers: 0, kmRateCents: 23 }
    await expect(create(event)).rejects.toMatchObject({ statusCode: 422 })
    expect(inserted).toBeNull()
  })

  it('refuses a gig that does not exist', async () => {
    gigExists = false
    body = { kind: 'cost', gigId, spentOn: '2026-10-01', description: 'X', category: 'overig', amountCents: 100, vatCents: 0 }
    await expect(create(event)).rejects.toMatchObject({ statusCode: 422, message: 'Deze gig bestaat niet' })
    expect(inserted).toBeNull()
  })
})
