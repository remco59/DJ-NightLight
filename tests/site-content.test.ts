import { describe, expect, it } from 'vitest'
import { siteContentInputSchema } from '../shared/schemas/site-content'

const base = {
  brandName: 'DJ NightLight',
  heroEyebrow: 'DJ',
  heroTitle: 'Night starts here',
  heroBody: 'Body',
  heroImageUrl: '',
  heroCtaLabel: 'Book',
  aboutEyebrow: 'About',
  aboutTitle: 'About title',
  aboutBody: 'About body',
  mediaEyebrow: 'Media',
  mediaTitle: 'Media title',
  mediaBody: 'Media body',
  showreelUrl: '',
  agendaEyebrow: 'Agenda',
  agendaTitle: 'Agenda title',
  agendaBody: 'Agenda body',
  bookingEyebrow: 'Booking',
  bookingTitle: 'Booking title',
  bookingBody: 'Booking body',
  contactEmail: '',
  contactPhone: '',
  instagramUrl: '',
  spotifyUrl: '',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  seoImageUrl: '',
  services: [],
  gallery: [],
}

describe('website content schema', () => {
  it('normalizes empty optional URLs and contact fields', () => {
    const parsed = siteContentInputSchema.parse(base)
    expect(parsed.heroImageUrl).toBeNull()
    expect(parsed.contactEmail).toBeNull()
  })

  it('rejects invalid gallery URLs', () => {
    expect(() => siteContentInputSchema.parse({
      ...base,
      gallery: [{ url: 'not-a-url', alt: 'test' }],
    })).toThrow()
  })
})
