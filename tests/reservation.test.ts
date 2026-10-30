import { describe, expect, it } from 'vitest'
import { cancellationFee, cancellationPercent } from '../shared/cancellation'
import { invoiceAmountDueCents, type InvoiceSnapshot } from '../shared/invoice'
import { quoteDraftInputSchema } from '../shared/quote'
import { quoteReservation, reservationCents, reservationInputSchema, reservationProblem } from '../shared/reservation'
import { buildInvoicePdf } from '../server/utils/invoice-pdf'

describe('reservation amount', () => {
  it('takes a percentage of the total, rounded to the cent', () => {
    expect(reservationCents(121000, { mode: 'percentage', value: 2500 })).toBe(30250)
    expect(reservationCents(10001, { mode: 'percentage', value: 3333 })).toBe(3333)
  })

  it('takes a fixed amount, never more than the total', () => {
    expect(reservationCents(121000, { mode: 'fixed', value: 5000 })).toBe(5000)
    expect(reservationCents(4000, { mode: 'fixed', value: 5000 })).toBe(4000)
  })

  it('is zero without a reservation', () => {
    expect(reservationCents(121000, null)).toBe(0)
    expect(reservationCents(121000, undefined)).toBe(0)
  })

  it('flags a fixed amount above the total and a reservation of nothing', () => {
    expect(reservationProblem(4000, { mode: 'fixed', value: 5000 })).toMatch(/hoger/)
    expect(reservationProblem(0, { mode: 'percentage', value: 2500 })).toMatch(/€ 0,00/)
    expect(reservationProblem(121000, { mode: 'percentage', value: 2500 })).toBeNull()
    expect(reservationProblem(121000, null)).toBeNull()
  })

  it('reads the reservation back from a quote row', () => {
    expect(quoteReservation({ reservationMode: 'fixed', reservationValue: 5000 })).toEqual({ mode: 'fixed', value: 5000 })
    expect(quoteReservation({ reservationMode: null, reservationValue: null })).toBeNull()
  })

  it('validates the input: positive, and a percentage of at most 100', () => {
    expect(reservationInputSchema.safeParse({ mode: 'percentage', value: 2500 }).success).toBe(true)
    expect(reservationInputSchema.safeParse({ mode: 'percentage', value: 10001 }).success).toBe(false)
    expect(reservationInputSchema.safeParse({ mode: 'fixed', value: 0 }).success).toBe(false)
    expect(reservationInputSchema.safeParse({ mode: 'fixed', value: 12.5 }).success).toBe(false)
  })

  it('is optional on a quote draft', () => {
    const draft = { issueDate: '2026-11-01', validUntil: '2026-11-15', currency: 'eur', vatMode: 'exclusive', vatRateBasisPoints: 2100, terms: '', notes: '', lines: [{ description: 'DJ', quantity: '1.000', unitPriceCents: 125000 }] }
    expect(quoteDraftInputSchema.safeParse(draft).success).toBe(true)
    expect(quoteDraftInputSchema.safeParse({ ...draft, reservation: null }).success).toBe(true)
    expect(quoteDraftInputSchema.safeParse({ ...draft, reservation: { mode: 'percentage', value: 2500 } }).success).toBe(true)
  })
})

describe('cancellation scale', () => {
  const start = new Date('2027-06-12T18:00:00.000Z')
  const before = (hours: number) => new Date(start.getTime() - hours * 3_600_000)

  it('is free up to 21 days, then 25%, 50% and 100%', () => {
    expect(cancellationPercent(start, before(21 * 24))).toBe(0)
    expect(cancellationPercent(start, before(21 * 24 - 1))).toBe(25)
    expect(cancellationPercent(start, before(7 * 24))).toBe(25)
    expect(cancellationPercent(start, before(7 * 24 - 1))).toBe(50)
    expect(cancellationPercent(start, before(24))).toBe(50)
    expect(cancellationPercent(start, before(23))).toBe(100)
    expect(cancellationPercent(start, before(-5))).toBe(100)
  })

  it('takes the paid reservation off the fee', () => {
    expect(cancellationFee({ totalCents: 100000, reservationPaidCents: 25000, startsAt: start, now: before(10 * 24) }))
      .toEqual({ percent: 25, feeCents: 25000, coveredCents: 25000, dueCents: 0 })
    expect(cancellationFee({ totalCents: 100000, reservationPaidCents: 25000, startsAt: start, now: before(48) }))
      .toEqual({ percent: 50, feeCents: 50000, coveredCents: 25000, dueCents: 25000 })
  })

  it('keeps a reservation that is larger than the fee, and charges nothing more when cancelling for free', () => {
    expect(cancellationFee({ totalCents: 100000, reservationPaidCents: 40000, startsAt: start, now: before(10 * 24) }))
      .toEqual({ percent: 25, feeCents: 25000, coveredCents: 25000, dueCents: 0 })
    expect(cancellationFee({ totalCents: 100000, reservationPaidCents: 25000, startsAt: start, now: before(30 * 24) }))
      .toEqual({ percent: 0, feeCents: 0, coveredCents: 0, dueCents: 0 })
  })
})

describe('invoice with a partial payment', () => {
  it('subtracts the prepayments from the total, never below zero', () => {
    expect(invoiceAmountDueCents(121000, [{ amountCents: 30250 }])).toBe(90750)
    expect(invoiceAmountDueCents(121000, [{ amountCents: 30250 }, { amountCents: 10000 }])).toBe(80750)
    expect(invoiceAmountDueCents(121000, undefined)).toBe(121000)
    expect(invoiceAmountDueCents(1000, [{ amountCents: 5000 }])).toBe(0)
  })

  const snapshot: InvoiceSnapshot = {
    invoiceNumber: 'FAC-2027-0001', issueDate: '2027-06-12', dueDate: '2027-07-12', currency: 'EUR', vatMode: 'inclusive', vatRateBasisPoints: 2100,
    business: { companyName: 'DJ NightLight', address: 'Straat 1', postalCode: '9201AA', city: 'Drachten', country: 'Nederland', email: 'info@example.test', phone: '', registrationNumber: '80074146', vatNumber: '', iban: 'NL00BANK0123456789' },
    client: { name: 'Sanne', email: 'sanne@example.test', billingAddress: '' },
    lines: [{ description: 'DJ-diensten', quantity: '1.000', unitPriceCents: 121000, totalCents: 121000 }],
    totals: { subtotalCents: 100000, vatAmountCents: 21000, totalCents: 121000 },
    paymentTerms: '', legalText: '', notes: '',
  }
  const text = (pdf: Uint8Array) => Buffer.from(pdf).toString('latin1')

  it('shows what is already paid and what is left on the PDF', () => {
    const pdf = text(buildInvoicePdf({ ...snapshot, prepayments: [{ label: 'reservering OFF-2027-0001', paidOn: '2027-01-05', amountCents: 30250 }] }))
    expect(pdf).toContain('Reeds betaald')
    expect(pdf).toContain('Nog te betalen')
    expect(pdf).toContain('907,50')
  })

  it('keeps the plain total without a prepayment', () => {
    const pdf = text(buildInvoicePdf(snapshot))
    expect(pdf).not.toContain('Nog te betalen')
    expect(pdf).toContain('Verschuldigd bedrag')
  })

  it('names the reservation on a quote', () => {
    const pdf = text(buildInvoicePdf({ ...snapshot, documentKind: 'quote', reservationCents: 30250 }))
    expect(pdf).toContain('Reserveringskosten bij akkoord')
  })
})
