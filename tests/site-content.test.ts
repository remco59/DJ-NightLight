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

const mediaUrl = '/api/media/123e4567-e89b-42d3-a456-426614174000'

describe('website content schema', () => {
  it('normalizes empty optional URLs and contact fields', () => {
    const parsed = siteContentInputSchema.parse(base)
    expect(parsed.heroImageUrl).toBeNull()
    expect(parsed.contactEmail).toBeNull()
    expect(parsed.contactPhone).toBeNull()
  })

  it('accepts API-shaped null values for optional fields', () => {
    const parsed = siteContentInputSchema.parse({
      ...base,
      heroImageUrl: null,
      showreelUrl: null,
      contactEmail: null,
      contactPhone: null,
      instagramUrl: null,
      spotifyUrl: null,
      seoImageUrl: null,
    })

    expect(parsed.heroImageUrl).toBeNull()
    expect(parsed.showreelUrl).toBeNull()
    expect(parsed.contactEmail).toBeNull()
    expect(parsed.contactPhone).toBeNull()
    expect(parsed.instagramUrl).toBeNull()
    expect(parsed.spotifyUrl).toBeNull()
    expect(parsed.seoImageUrl).toBeNull()
  })

  it('accepts NightLight media URLs for website image fields', () => {
    const parsed = siteContentInputSchema.parse({
      ...base,
      heroImageUrl: mediaUrl,
      seoImageUrl: mediaUrl,
      gallery: [{ url: mediaUrl, alt: 'NightLight behind the booth' }],
    })

    expect(parsed.heroImageUrl).toBe(mediaUrl)
    expect(parsed.seoImageUrl).toBe(mediaUrl)
    expect(parsed.gallery[0]?.url).toBe(mediaUrl)
  })

  it('keeps absolute external image URLs valid', () => {
    const externalUrl = 'https://images.example.com/nightlight.webp'
    const parsed = siteContentInputSchema.parse({
      ...base,
      heroImageUrl: externalUrl,
      gallery: [{ url: externalUrl, alt: 'NightLight crowd' }],
    })

    expect(parsed.heroImageUrl).toBe(externalUrl)
    expect(parsed.gallery[0]?.url).toBe(externalUrl)
  })

  it('rejects invalid gallery URLs', () => {
    expect(() => siteContentInputSchema.parse({
      ...base,
      gallery: [{ url: 'not-a-url', alt: 'test' }],
    })).toThrow()
  })

  it('rejects arbitrary relative image URLs', () => {
    expect(() => siteContentInputSchema.parse({
      ...base,
      heroImageUrl: '/uploads/random-image.webp',
    })).toThrow()
  })
})
