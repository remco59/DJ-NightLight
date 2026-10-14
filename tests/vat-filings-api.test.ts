import { beforeEach, describe, expect, it, vi } from 'vitest'

let existing: Array<Record<string, unknown>> = []
let upserted: Record<string, unknown> | null = null
let deleted = false
const audits: Array<Record<string, unknown>> = []
let loads = 0

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
let body: unknown = {}
vi.stubGlobal('readBody', async () => body)
vi.mock('../server/utils/require-staff', () => ({ requireStaff: async () => ({ id: 'u1', role: 'owner' }) }))
vi.mock('../server/utils/audit', () => ({ recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry) } }))
vi.mock('../server/utils/finance-data', () => ({
  loadFinanceYear: async () => {
    loads += 1
    return {
      invoices: [{ issueDate: '2026-08-01', subtotalCents: 100000, vatAmountCents: 21000, vatMode: 'exclusive', vatRateBasisPoints: 2100 }],
      expenses: [{ spentOn: '2026-08-02', vatCents: 2100 }],
    }
  },
}))
vi.mock('../server/utils/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => existing }) }) }),
    delete: () => ({ where: async () => { deleted = true } }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({ returning: async () => { upserted = values; return [values] } }),
      }),
    }),
  },
}))

const save = (await import('../server/api/admin/finance/vat-filings.put')).default as unknown as (event: object) => Promise<{ filing: Record<string, unknown> | null }>

describe('recording a filed VAT return', () => {
  beforeEach(() => {
    existing = []
    upserted = null
    deleted = false
    loads = 0
    audits.length = 0
  })

  it('stores the amount as it is on the server when first marked as filed', async () => {
    body = { year: 2026, period: 'q3', submittedOn: '2026-10-20', paidOn: null, filedBalanceCents: 1 }
    const { filing } = await save({})
    expect(filing).toMatchObject({ year: 2026, period: 'q3', submittedOn: '2026-10-20', paidOn: null, filedBalanceCents: 18900 })
    expect(audits[0]).toMatchObject({ entityType: 'vat_filing', entityId: '2026-q3', action: 'created' })
  })

  it('keeps the amount from the first filing when only the payment is added', async () => {
    existing = [{ submittedOn: '2026-10-20', filedBalanceCents: 5000 }]
    body = { year: 2026, period: 'q3', submittedOn: '2026-10-20', paidOn: '2026-10-25' }
    const { filing } = await save({})
    expect(filing).toMatchObject({ filedBalanceCents: 5000, paidOn: '2026-10-25' })
    expect(loads).toBe(0)
    expect(audits[0]).toMatchObject({ action: 'updated' })
  })

  it('removes the record when both dates are cleared', async () => {
    body = { year: 2026, period: 'q3', submittedOn: null, paidOn: null }
    expect(await save({})).toEqual({ filing: null })
    expect(deleted).toBe(true)
    expect(upserted).toBeNull()
    expect(audits[0]).toMatchObject({ action: 'cleared' })
  })

  it('refuses a payment before the filing and a whole year', async () => {
    body = { year: 2026, period: 'q3', submittedOn: '2026-10-20', paidOn: '2026-10-01' }
    await expect(save({})).rejects.toMatchObject({ statusCode: 422 })
    body = { year: 2026, period: 'year', submittedOn: '2026-10-20', paidOn: null }
    await expect(save({})).rejects.toMatchObject({ statusCode: 422 })
    expect(upserted).toBeNull()
  })
})
