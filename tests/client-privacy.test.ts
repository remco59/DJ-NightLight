import { describe, expect, it } from 'vitest'
import {
  anonymizeBlocker,
  anonymizedClientValues,
  ANONYMIZED_CLIENT_NAME,
  clientDisplayName,
  clientExportFileName,
  scrubQuoteSnapshot,
} from '../shared/client-privacy'
import type { InvoiceSnapshot } from '../shared/invoice'

describe('client display name', () => {
  it('prefers the company, then the person, then a neutral word', () => {
    expect(clientDisplayName({ companyName: 'Bakkerij Smit', firstName: 'Piet' })).toBe('Bakkerij Smit')
    expect(clientDisplayName({ firstName: 'Sanne', lastName: 'de Vries' })).toBe('Sanne de Vries')
    expect(clientDisplayName({})).toBe('klant')
  })
})

describe('export file name', () => {
  it('is lower case ASCII with the date', () => {
    expect(clientExportFileName({ firstName: 'Zoë', lastName: 'van der Meer' }, '2026-10-13')).toBe('klantgegevens-zoe-van-der-meer-2026-10-13.json')
  })

  it('cannot break out of a download header', () => {
    const name = clientExportFileName({ companyName: 'Evil"; filename="x.exe\r\nSet-Cookie: a=b' }, '2026-10-13')
    expect(name).toMatch(/^klantgegevens-[a-z0-9-]+-2026-10-13\.json$/)
  })

  it('falls back for a name without usable characters', () => {
    expect(clientExportFileName({ companyName: '###' }, '2026-10-13')).toBe('klantgegevens-klant-2026-10-13.json')
  })

  it('keeps very long names short', () => {
    expect(clientExportFileName({ companyName: 'a'.repeat(300) }, '2026-10-13').length).toBeLessThan(90)
  })
})

describe('anonymized client', () => {
  it('holds no personal data', () => {
    const values = anonymizedClientValues()
    expect(values.firstName).toBe(ANONYMIZED_CLIENT_NAME)
    for (const key of ['lastName', 'companyName', 'email', 'invoiceEmail', 'phone', 'billingAddress', 'notes', 'stripeCustomerId'] as const) {
      expect(values[key], key).toBeNull()
    }
  })
})

describe('quote snapshot scrub', () => {
  const snapshot = {
    documentKind: 'quote', invoiceNumber: 'OFF-2026-0001', issueDate: '2026-11-01', dueDate: '2026-11-15', currency: 'EUR', vatMode: 'exclusive', vatRateBasisPoints: 2100,
    business: { companyName: 'DJ NightLight', address: '', postalCode: '', city: '', country: 'Nederland', email: '', phone: '', registrationNumber: '', vatNumber: '', iban: '' },
    client: { name: 'Sanne de Vries', email: 'sanne@example.com', billingAddress: 'Straat 1' },
    lines: [{ description: 'DJ', quantity: '1.000', unitPriceCents: 100000, totalCents: 100000 }],
    totals: { subtotalCents: 100000, vatAmountCents: 21000, totalCents: 121000 },
    paymentTerms: '', legalText: '', notes: 'bel haar op 0612345678', portalUrl: 'https://djnightlight.nl/client/geheim',
  } satisfies InvoiceSnapshot

  it('removes the client, the notes and the personal link but keeps the amounts', () => {
    const scrubbed = scrubQuoteSnapshot(snapshot)
    expect(scrubbed.client).toEqual({ name: ANONYMIZED_CLIENT_NAME, email: '', billingAddress: '' })
    expect(scrubbed.notes).toBe('')
    expect(scrubbed).not.toHaveProperty('portalUrl')
    expect(scrubbed.totals).toEqual(snapshot.totals)
    expect(JSON.stringify(scrubbed)).not.toMatch(/sanne|0612345678|geheim/i)
  })

  it('does not change the original', () => {
    scrubQuoteSnapshot(snapshot)
    expect(snapshot.client.name).toBe('Sanne de Vries')
  })
})

describe('erasing is blocked by upcoming bookings', () => {
  it('allows it without upcoming booked gigs', () => {
    expect(anonymizeBlocker(0)).toBeNull()
  })

  it('explains what to do first, in the singular and the plural', () => {
    expect(anonymizeBlocker(1)).toContain('1 geboekte gig in de toekomst')
    expect(anonymizeBlocker(3)).toContain('3 geboekte gigs in de toekomst')
  })
})
