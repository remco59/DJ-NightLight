import { describe, expect, it, vi } from 'vitest'
import { buildInvoicePdf } from '../server/utils/invoice-pdf'
import { renderBrandedEmailHtml } from '../shared/email-automation'
import type { InvoiceSnapshot } from '../shared/invoice'
import { ownerNotificationMessage, ownerNotificationSample } from '../shared/owner-notifications'
import { addDaysToDate, quoteAcceptSchema, quoteDeclineSchema, quoteDisplayStatus, quoteDraftInputSchema, quoteIsOpenForResponse } from '../shared/quote'

vi.mock('../server/utils/db', () => ({ db: {}, sql: vi.fn() }))
const { buildQuoteSnapshot, quoteSendBlockers } = await import('../server/utils/quote-data')

describe('quote status', () => {
  it('turns a sent quote into expired after its last valid day', () => {
    expect(quoteDisplayStatus({ status: 'sent', validUntil: '2026-11-10' }, '2026-11-10')).toBe('sent')
    expect(quoteDisplayStatus({ status: 'sent', validUntil: '2026-11-10' }, '2026-11-11')).toBe('expired')
  })

  it('keeps the other statuses as they are', () => {
    for (const status of ['draft', 'accepted', 'declined', 'void'] as const) {
      expect(quoteDisplayStatus({ status, validUntil: '2020-01-01' }, '2026-11-11')).toBe(status)
    }
  })

  it('is only open for a response while sent and valid', () => {
    expect(quoteIsOpenForResponse({ status: 'sent', validUntil: '2026-11-10' }, '2026-11-10')).toBe(true)
    expect(quoteIsOpenForResponse({ status: 'sent', validUntil: '2026-11-10' }, '2026-11-11')).toBe(false)
    expect(quoteIsOpenForResponse({ status: 'accepted', validUntil: '2030-01-01' }, '2026-11-10')).toBe(false)
  })

  it('adds days across month ends', () => {
    expect(addDaysToDate('2026-11-25', 14)).toBe('2026-12-09')
    expect(addDaysToDate('2026-12-25', 14)).toBe('2027-01-08')
  })
})

describe('quote input', () => {
  const draft = { issueDate: '2026-11-01', validUntil: '2026-11-15', currency: 'eur', vatMode: 'exclusive', vatRateBasisPoints: 2100, terms: '', notes: '', lines: [{ description: 'DJ', quantity: '1.000', unitPriceCents: 125000 }] }

  it('accepts a valid draft and uppercases the currency', () => {
    expect(quoteDraftInputSchema.parse(draft).currency).toBe('EUR')
  })

  it('rejects a validity date before the quote date and an empty quote', () => {
    expect(quoteDraftInputSchema.safeParse({ ...draft, validUntil: '2026-10-31' }).success).toBe(false)
    expect(quoteDraftInputSchema.safeParse({ ...draft, lines: [] }).success).toBe(false)
  })

  it('needs a name and an explicit tick to accept', () => {
    expect(quoteAcceptSchema.safeParse({ acceptedName: 'Sanne', agree: true }).success).toBe(true)
    expect(quoteAcceptSchema.safeParse({ acceptedName: 'S', agree: true }).success).toBe(false)
    expect(quoteAcceptSchema.safeParse({ acceptedName: 'Sanne', agree: false }).success).toBe(false)
    expect(quoteAcceptSchema.safeParse({ acceptedName: 'Sanne' }).success).toBe(false)
  })

  it('makes the decline reason optional', () => {
    expect(quoteDeclineSchema.parse({})).toEqual({ reason: '' })
  })
})

const detail = {
  quote: {
    id: 'q1', gigId: 'g1', clientId: 'c1', quoteNumber: null, status: 'draft' as const, issueDate: '2026-11-01', validUntil: '2026-11-15', currency: 'EUR',
    vatMode: 'exclusive' as const, vatRateBasisPoints: 2100, subtotalCents: 0, vatAmountCents: 0, totalCents: 0, terms: 'Geldig tot 15 november.', notes: '',
    gigStartsAt: new Date('2027-06-12T12:00:00.000Z'), gigTitle: 'Bruiloft', clientFirstName: 'Sanne', clientLastName: 'de Vries', clientCompanyName: null, clientEmail: 'sanne@example.com', clientBillingAddress: 'Straat 1',
  },
  lines: [{ description: 'DJ-diensten', quantity: '1.000', unitPriceCents: 100000 }],
} as never
const settings = { companyName: 'DJ NightLight', address: 'Kade 1', postalCode: '9711AA', city: 'Groningen', country: 'Nederland', email: 'info@example.com', phone: '', registrationNumber: '123', vatNumber: 'NL1', iban: 'NL00BANK0123456789' } as never

describe('quote snapshot and pdf', () => {
  it('freezes the lines and totals with the quote number', () => {
    const snapshot = buildQuoteSnapshot(detail, settings, 'OFF-2026-0001', 'https://djnightlight.nl/client/abc')
    expect(snapshot).toMatchObject({ documentKind: 'quote', invoiceNumber: 'OFF-2026-0001', dueDate: '2026-11-15', paymentTerms: 'Geldig tot 15 november.' })
    expect(snapshot.totals).toEqual({ subtotalCents: 100000, vatAmountCents: 21000, totalCents: 121000 })
    expect(snapshot.client.name).toBe('Sanne de Vries')
  })

  it('renders a quote in the invoice layout without any payment details', () => {
    const text = buildInvoicePdf(buildQuoteSnapshot(detail, settings, 'OFF-2026-0001')).toString('latin1')
    expect(text).toContain('(Offerte)')
    expect(text).toContain('Offertenummer')
    expect(text).toContain('Geldig tot')
    expect(text).toContain('Totaalbedrag')
    expect(text).not.toContain('bankoverschrijving')
    expect(text).not.toContain('Verschuldigd bedrag')
    expect(text).not.toContain('(Factuur)')
  })

  it('still renders an invoice as before', () => {
    const invoice: InvoiceSnapshot = { ...buildQuoteSnapshot(detail, settings, 'NL-2026-0001'), documentKind: undefined }
    const text = buildInvoicePdf(invoice).toString('latin1')
    expect(text).toContain('(Factuur)')
    expect(text).toContain('Verschuldigd bedrag')
    expect(text).toContain('bankoverschrijving')
  })
})

describe('sending a quote', () => {
  it('has no blockers for a complete draft', () => {
    expect(quoteSendBlockers(detail, settings, '2026-11-02')).toEqual([])
  })

  it('blocks an expired date, a zero total and missing details', () => {
    const empty = { quote: { ...(detail as { quote: object }).quote, clientId: null }, lines: [{ description: ' ', quantity: '1.000', unitPriceCents: 0 }] } as never
    const blockers = quoteSendBlockers(empty, { ...(settings as object), companyName: '' } as never, '2026-12-01')
    expect(blockers.join(' ')).toMatch(/omschrijving/)
    expect(blockers.join(' ')).toMatch(/€ 0,00/)
    expect(blockers.join(' ')).toMatch(/verleden/)
    expect(blockers.join(' ')).toMatch(/klant/)
    expect(blockers.join(' ')).toMatch(/bedrijfsnaam/)
  })
})

describe('quote response notification', () => {
  const siteUrl = 'https://djnightlight.nl'

  it('reports an acceptance with who accepted', () => {
    const message = ownerNotificationMessage('quote_response', { gigId: 'g1', gigTitle: 'Bruiloft Jansen', quoteNumber: 'OFF-2026-0001', totalCents: 121000, currency: 'EUR', outcome: 'accepted', acceptedName: 'Piet' }, siteUrl)
    expect(message.subject).toBe('Offerte geaccepteerd: Bruiloft Jansen')
    expect(message.text).toContain('Piet heeft de offerte OFF-2026-0001')
    expect(message.variables).toMatchObject({ outcome: 'Geaccepteerd', adminUrl: 'https://djnightlight.nl/admin/gigs/g1' })
  })

  it('reports a decline with the reason on one line', () => {
    const message = ownerNotificationMessage('quote_response', { gigId: 'g1', gigTitle: 'Bruiloft', outcome: 'declined', reason: 'Te duur\n\nsorry' }, siteUrl)
    expect(message.subject).toBe('Offerte afgewezen: Bruiloft')
    expect(message.text).toContain('Reden: “Te duur sorry”')
    expect(message.text).not.toMatch(/\n/)
  })

  it('renders as a branded email', () => {
    const message = ownerNotificationMessage('quote_response', ownerNotificationSample('quote_response'), siteUrl)
    const html = renderBrandedEmailHtml(message.templateKey, message.text, message.variables, { siteUrl })
    expect(html).toContain('Reactie op je offerte')
    expect(html).toContain('OFF-2027-0001')
  })
})
