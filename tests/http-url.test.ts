import { describe, expect, it } from 'vitest'
import { clientPortalImageInputSchema } from '../shared/client-portal'
import { httpUrl } from '../shared/schemas/http-url'
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
