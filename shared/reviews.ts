/** Name shown next to a published review: first name only, as the client's consent says. */
export function publicReviewAuthor(authorName: string | null | undefined) {
  const first = (authorName ?? '').trim().split(/\s+/)[0] ?? ''
  return first.slice(0, 40) || 'Klant'
}

/** A published review needs the client's consent and some text to show. */
export function canPublishReview(review: { publicConsent: boolean, comment: string | null }) {
  return review.publicConsent && Boolean(review.comment?.trim())
}

export function reviewStars(rating: number) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`
}
