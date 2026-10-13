import { describe, expect, it } from 'vitest'
import { absoluteUrl, buildRobotsTxt, buildSitemapXml, businessJsonLd, eventJsonLd, isIndexableSite, jsonLdScript } from '../shared/seo'

describe('indexable site', () => {
  it('allows the production host', () => {
    expect(isIndexableSite('https://djnightlight.nl')).toBe(true)
  })

  it('blocks local, staging and invalid hosts', () => {
    expect(isIndexableSite('http://localhost:3000')).toBe(false)
    expect(isIndexableSite('https://dev.djnightlight.nl')).toBe(false)
    expect(isIndexableSite('https://staging.djnightlight.nl')).toBe(false)
    expect(isIndexableSite('not a url')).toBe(false)
  })
})

describe('absolute url', () => {
  it('joins on the origin and drops trailing slashes, queries and hashes', () => {
    expect(absoluteUrl('https://djnightlight.nl/', '/')).toBe('https://djnightlight.nl/')
    expect(absoluteUrl('https://djnightlight.nl', '/agenda/')).toBe('https://djnightlight.nl/agenda')
    expect(absoluteUrl('https://djnightlight.nl', 'boeken?x=1#top')).toBe('https://djnightlight.nl/boeken')
  })
})

describe('robots.txt', () => {
  it('hides the back office and points to the sitemap', () => {
    const robots = buildRobotsTxt('https://djnightlight.nl')
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).toContain('Disallow: /client/')
    expect(robots).toContain('Sitemap: https://djnightlight.nl/sitemap.xml')
  })

  it('blocks everything on staging', () => {
    expect(buildRobotsTxt('https://dev.djnightlight.nl')).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('sitemap', () => {
  it('lists absolute urls with an optional last modified date', () => {
    const xml = buildSitemapXml('https://djnightlight.nl', [
      { path: '/' },
      { path: '/diensten/bruiloft', lastModified: '2026-09-01T10:00:00.000Z' },
    ])
    expect(xml).toContain('<loc>https://djnightlight.nl/</loc>')
    expect(xml).toContain('<loc>https://djnightlight.nl/diensten/bruiloft</loc><lastmod>2026-09-01</lastmod>')
  })

  it('escapes special characters', () => {
    expect(buildSitemapXml('https://djnightlight.nl', [{ path: '/a&b' }])).toContain('/a&amp;b')
  })
})

describe('json-ld', () => {
  it('describes the business and leaves out empty fields', () => {
    const data = businessJsonLd({ siteUrl: 'https://djnightlight.nl', name: 'DJ NightLight', email: 'info@example.com', phone: '', image: '/uploads/hero.jpg', sameAs: ['https://instagram.com/x', null] })
    expect(data).toMatchObject({ '@type': 'EntertainmentBusiness', 'name': 'DJ NightLight', 'image': 'https://djnightlight.nl/uploads/hero.jpg', 'sameAs': ['https://instagram.com/x'] })
    expect(data).not.toHaveProperty('telephone')
    expect(data).not.toHaveProperty('description')
  })

  it('describes an agenda item without a street address', () => {
    const data = eventJsonLd({ siteUrl: 'https://djnightlight.nl', title: 'Clubavond', startsAt: '2026-11-14T21:00:00.000Z', endsAt: null, location: 'Simplon, Groningen', organizer: 'DJ NightLight' })
    expect(data).toMatchObject({ '@type': 'Event', 'startDate': '2026-11-14T21:00:00.000Z', 'location': { '@type': 'Place', 'name': 'Simplon, Groningen' } })
    expect(data).not.toHaveProperty('endDate')
  })

  it('cannot break out of the script tag', () => {
    expect(jsonLdScript({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>')
  })
})
