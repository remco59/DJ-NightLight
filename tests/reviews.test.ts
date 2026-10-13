import { describe, expect, it } from 'vitest'
import { canPublishReview, publicReviewAuthor, reviewStars } from '../shared/reviews'
import { ownerNotificationMessage, ownerNotificationSample } from '../shared/owner-notifications'
import { renderBrandedEmailHtml } from '../shared/email-automation'

describe('public review author', () => {
  it('shows the first name only', () => {
    expect(publicReviewAuthor('Sanne de Vries')).toBe('Sanne')
    expect(publicReviewAuthor('  Piet  ')).toBe('Piet')
  })

  it('falls back to a neutral name', () => {
    expect(publicReviewAuthor(null)).toBe('Klant')
    expect(publicReviewAuthor('   ')).toBe('Klant')
  })

  it('cuts off absurdly long names', () => {
    expect(publicReviewAuthor('A'.repeat(200)).length).toBe(40)
  })
})

describe('publishing a review', () => {
  it('needs consent and some text', () => {
    expect(canPublishReview({ publicConsent: true, comment: 'Top avond' })).toBe(true)
    expect(canPublishReview({ publicConsent: false, comment: 'Top avond' })).toBe(false)
    expect(canPublishReview({ publicConsent: true, comment: '   ' })).toBe(false)
    expect(canPublishReview({ publicConsent: true, comment: null })).toBe(false)
  })
})

describe('review stars', () => {
  it('fills the right number of stars', () => {
    expect(reviewStars(5)).toBe('★★★★★')
    expect(reviewStars(3)).toBe('★★★☆☆')
    expect(reviewStars(9)).toBe('★★★★★')
    expect(reviewStars(-1)).toBe('☆☆☆☆☆')
  })
})

describe('new review notification', () => {
  const siteUrl = 'https://djnightlight.nl'

  it('summarises the review and whether it may be shown', () => {
    const message = ownerNotificationMessage('review_received', { gigTitle: 'Bruiloft Jansen', authorName: 'Piet', rating: 5, comment: 'Top!', publicConsent: 1 }, siteUrl)
    expect(message.subject).toBe('Nieuwe review: 5 sterren voor Bruiloft Jansen')
    expect(message.text).toContain('Piet gaf Bruiloft Jansen 5 van 5 sterren.')
    expect(message.text).toContain('“Top!”')
    expect(message.variables).toMatchObject({ publicConsent: 'Ja, na jouw goedkeuring', adminUrl: 'https://djnightlight.nl/admin/reviews' })
  })

  it('uses the singular for one star and says when there is no consent', () => {
    const message = ownerNotificationMessage('review_received', { gigTitle: 'X', rating: 1, publicConsent: 0 }, siteUrl)
    expect(message.subject).toContain('1 ster voor')
    expect(message.variables.publicConsent).toBe('Nee')
  })

  it('keeps a long comment short and on one line', () => {
    const message = ownerNotificationMessage('review_received', { gigTitle: 'X', rating: 4, comment: `regel\n\n${'a'.repeat(1000)}` }, siteUrl)
    expect(message.text.length).toBeLessThan(400)
    expect(message.text).not.toMatch(/\n/)
  })

  it('renders as a branded email', () => {
    const message = ownerNotificationMessage('review_received', ownerNotificationSample('review_received'), siteUrl)
    const html = renderBrandedEmailHtml(message.templateKey, message.text, message.variables, { siteUrl })
    expect(html).toContain('Je hebt een nieuwe review')
    expect(html).toContain('href="https://djnightlight.nl/admin/reviews"')
  })
})
