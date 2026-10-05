import { describe, expect, it } from 'vitest'
import { clientPortalImageInputSchema } from '../shared/client-portal'
import { httpUrl, isInternalPath } from '../shared/schemas/http-url'
import { landingPageInputSchema } from '../shared/schemas/landing-page'
import { siteContentInputSchema } from '../shared/schemas/site-content'
import { venueInputSchema } from '../shared/schemas/venue'
import { defaultSiteContent } from '../server/utils/site-content-defaults'

const dangerous = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'ftp://example.nl/x']
const safe = ['https://instagram.com/nightlight', 'http://example.nl/pad?x=1']

describe('httpUrl', () => {
  it.each(safe)('accepts %s', (value) => {
    expect(httpUrl.safeParse(value).success).toBe(true)
  })

  it.each(dangerous)('rejects %s', (value) => {
    expect(httpUrl.safeParse(value).success).toBe(false)
  })
})

describe('schemas that end up in href/src only accept http(s) links', () => {
  it.each(['instagramUrl', 'spotifyUrl', 'showreelUrl'] as const)('site content %s', (field) => {
    expect(siteContentInputSchema.safeParse({ ...defaultSiteContent, [field]: 'https://example.nl/x' }).success).toBe(true)
    for (const value of dangerous) {
      expect(siteContentInputSchema.safeParse({ ...defaultSiteContent, [field]: value }).success, value).toBe(false)
    }
  })

  it.each(['heroImageUrl', 'seoImageUrl'] as const)('site content %s', (field) => {
    for (const value of dangerous) {
      expect(siteContentInputSchema.safeParse({ ...defaultSiteContent, [field]: value }).success, value).toBe(false)
    }
  })

  it('site content gallery images', () => {
    expect(siteContentInputSchema.safeParse({ ...defaultSiteContent, gallery: [{ url: 'javascript:alert(1)', alt: 'x' }] }).success).toBe(false)
  })

  it('venue website', () => {
    expect(venueInputSchema.safeParse({ name: 'Zaal', website: 'https://zaal.nl' }).success).toBe(true)
    expect(venueInputSchema.safeParse({ name: 'Zaal', website: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('client portal image', () => {
    expect(clientPortalImageInputSchema.safeParse({ imageUrl: 'https://example.nl/a.jpg' }).success).toBe(true)
    expect(clientPortalImageInputSchema.safeParse({ imageUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
})

describe('internal paths', () => {
  it.each(['/boeken', '/diensten/bruiloft?x=1', '/'])('treats %s as internal', (value) => {
    expect(isInternalPath(value)).toBe(true)
  })

  it.each(['//evil.example', '/\\evil.example', 'boeken', 'https://example.nl', ''])('does not treat %j as internal', (value) => {
    expect(isInternalPath(value)).toBe(false)
  })

  it('landing page links and images no longer accept protocol-relative URLs', () => {
    const input = {
      slug: 'bruiloften', navLabel: 'Bruiloften', eyebrow: 'DJ', title: 'Titel', intro: 'Intro', body: 'Body',
      heroImageUrl: '', ctaLabel: 'Boeken', ctaHref: '/boeken', published: true, showInNavigation: false,
      indexable: true, seoTitle: 'SEO', seoDescription: 'Beschrijving', seoImageUrl: '', ordering: 10,
    }
    expect(landingPageInputSchema.safeParse(input).success).toBe(true)
    expect(landingPageInputSchema.safeParse({ ...input, ctaHref: '//evil.example/x' }).success).toBe(false)
    expect(landingPageInputSchema.safeParse({ ...input, ctaHref: '/\\evil.example' }).success).toBe(false)
    expect(landingPageInputSchema.safeParse({ ...input, heroImageUrl: '//evil.example/a.jpg' }).success).toBe(false)
    expect(landingPageInputSchema.safeParse({ ...input, ctaHref: 'https://example.nl/boeken' }).success).toBe(true)
  })
})
