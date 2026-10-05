import { describe, expect, it } from 'vitest'
import { defaultLandingPageSections, landingPageInputSchema } from '../shared/schemas/landing-page'

const base = {
  slug: 'bruiloften',
  navLabel: 'Bruiloften',
  eyebrow: 'DJ voor bruiloften',
  title: 'Een bruiloft die klinkt als jullie.',
  intro: 'Intro',
  body: 'Body',
  heroImageUrl: '',
  ctaLabel: 'Boeken',
  ctaHref: '/boeken',
  published: true,
  showInNavigation: false,
  indexable: true,
  seoTitle: 'Bruiloft DJ',
  seoDescription: 'Beschrijving',
  seoImageUrl: '',
  ordering: 10,
}

describe('landing page controls', () => {
  it('allows a published indexed page to remain hidden from navigation', () => {
    const page = landingPageInputSchema.parse(base)
    expect(page.published).toBe(true)
    expect(page.showInNavigation).toBe(false)
    expect(page.indexable).toBe(true)
  })

  it('keeps publishing, navigation visibility and indexing independent', () => {
    const page = landingPageInputSchema.parse({
      ...base,
      published: false,
      showInNavigation: true,
      indexable: false,
    })

    expect(page.published).toBe(false)
    expect(page.showInNavigation).toBe(true)
    expect(page.indexable).toBe(false)
  })

  it('accepts internal media-library paths', () => {
    const page = landingPageInputSchema.parse({
      ...base,
      heroImageUrl: '/api/media/test-asset',
      seoImageUrl: '/api/media/test-asset?variant=thumb',
    })
    expect(page.heroImageUrl).toBe('/api/media/test-asset')
    expect(page.seoImageUrl).toContain('/api/media/')
  })

  it('adds complete editable section defaults', () => {
    const page = landingPageInputSchema.parse(base)
    expect(page.sections.benefits).toHaveLength(3)
    expect(page.sections.galleryImages).toHaveLength(4)
    expect(page.sections.closingTitle).toBe(defaultLandingPageSections('bruiloften').closingTitle)
  })

  it('accepts customized redesigned section content', () => {
    const sections = defaultLandingPageSections('studentenfeesten')
    sections.storyImageUrl = '/api/media/story'
    sections.galleryImages[0] = { url: '/api/media/gallery-1', alt: 'Volle studentendansvloer' }
    sections.closingTitle = 'Tot op de dansvloer.'

    const page = landingPageInputSchema.parse({
      ...base,
      slug: 'studentenfeesten',
      sections,
    })

    expect(page.sections.storyImageUrl).toBe('/api/media/story')
    expect(page.sections.galleryImages[0]?.alt).toBe('Volle studentendansvloer')
    expect(page.sections.closingTitle).toBe('Tot op de dansvloer.')
  })
})
