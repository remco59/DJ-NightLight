import { describe, expect, it } from 'vitest'
import { landingPageInputSchema } from '../shared/schemas/landing-page'

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
})
