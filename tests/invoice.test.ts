import { describe, expect, it } from 'vitest'
import { calculateInvoiceTotals, calculateLineTotalCents, formatInvoiceNumber, type InvoiceSnapshot } from '../shared/invoice'
import { buildInvoicePdf } from '../server/utils/invoice-pdf'

describe('invoice calculations', () => {
  const lines = [
    { description: 'DJ services', quantity: '1.000', unitPriceCents: 10000 },
    { description: 'Extra hour', quantity: '1.500', unitPriceCents: 2000 },
  ]

  it('calculates decimal quantities in integer cents', () => {
    expect(calculateLineTotalCents(lines[1]!)).toBe(3000)
  })

  it('adds VAT to exclusive prices', () => {
    expect(calculateInvoiceTotals(lines, 'exclusive', 2100)).toEqual({ subtotalCents: 13000, vatAmountCents: 2730, totalCents: 15730 })
  })

  it('extracts VAT from inclusive prices', () => {
    expect(calculateInvoiceTotals([{ description: 'Inclusive', quantity: '1.000', unitPriceCents: 12100 }], 'inclusive', 2100)).toEqual({ subtotalCents: 10000, vatAmountCents: 2100, totalCents: 12100 })
  })

  it('supports exempt invoices', () => {
    expect(calculateInvoiceTotals(lines, 'exempt', 2100)).toEqual({ subtotalCents: 13000, vatAmountCents: 0, totalCents: 13000 })
  })

  it('formats stable sequential invoice numbers', () => {
    expect(formatInvoiceNumber('nl', 2026, 12)).toBe('NL-2026-0012')
  })
})

describe('invoice PDF', () => {
  it('is deterministic for a finalized snapshot', () => {
    const snapshot: InvoiceSnapshot = {
      invoiceNumber: 'NL-2026-0001', issueDate: '2026-09-20', dueDate: '2026-10-20', currency: 'EUR', vatMode: 'exclusive', vatRateBasisPoints: 2100,
      business: { companyName: 'DJ NightLight', address: '', postalCode: '', city: 'Groningen', country: 'Nederland', email: '', phone: '', registrationNumber: '', vatNumber: '', iban: 'NL00TEST' },
      client: { name: 'Test client', email: '', billingAddress: '' },
      lines: [{ description: 'DJ services', quantity: '1.000', unitPriceCents: 10000, totalCents: 10000 }],
      totals: { subtotalCents: 10000, vatAmountCents: 2100, totalCents: 12100 }, paymentTerms: '30 days', legalText: '', notes: '',
    }
    const first = buildInvoicePdf(snapshot)
    const second = buildInvoicePdf(snapshot)
    expect(first.equals(second)).toBe(true)
    expect(first.subarray(0, 8).toString()).toBe('%PDF-1.4')
  })
})
