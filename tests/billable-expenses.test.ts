import { describe, expect, it } from 'vitest'
import { billableInvoiceLine, costInputSchema, mileageInputSchema } from '../shared/finance'
import { calculateInvoiceTotals } from '../shared/invoice'

const cost = { kind: 'cost', description: 'Huur lichtset', amountCents: 12100, vatCents: 2100, kilometers: null, kmRateCents: null }
const trip = { kind: 'mileage', description: 'Kilometers', amountCents: 920, vatCents: 0, kilometers: '40.0', kmRateCents: 23 }

describe('invoice line for a billable item', () => {
  it('bills a cost without VAT when the invoice adds VAT', () => {
    expect(billableInvoiceLine(cost, 'exclusive')).toEqual({ description: 'Huur lichtset', quantity: '1.000', unitPriceCents: 10000 })
    const line = billableInvoiceLine(cost, 'exclusive')
    expect(calculateInvoiceTotals([line], 'exclusive', 2100).totalCents).toBe(12100)
  })

  it('bills what was paid when the invoice already includes VAT or has none', () => {
    expect(billableInvoiceLine(cost, 'inclusive').unitPriceCents).toBe(12100)
    expect(billableInvoiceLine(cost, 'exempt').unitPriceCents).toBe(12100)
  })

  it('bills a trip per kilometre', () => {
    const line = billableInvoiceLine(trip, 'exclusive')
    expect(line).toEqual({ description: 'Reiskosten (kilometers)', quantity: '40.0', unitPriceCents: 23 })
    expect(calculateInvoiceTotals([line], 'exempt', 0).totalCents).toBe(920)
  })

  it('keeps a trip description', () => {
    expect(billableInvoiceLine({ ...trip, description: 'heen en terug' }, 'exclusive').description).toBe('Reiskosten (kilometers) — heen en terug')
  })
})

describe('billable flag', () => {
  it('is off by default', () => {
    expect(costInputSchema.parse({ kind: 'cost', spentOn: '2026-10-01', description: 'x', category: 'overig', amountCents: 100 }).billable).toBe(false)
    expect(mileageInputSchema.parse({ kind: 'mileage', spentOn: '2026-10-01', kilometers: 5, kmRateCents: 23 }).billable).toBe(false)
  })
  it('can be switched on', () => {
    expect(mileageInputSchema.parse({ kind: 'mileage', spentOn: '2026-10-01', kilometers: 5, kmRateCents: 23, billable: true }).billable).toBe(true)
  })
})
