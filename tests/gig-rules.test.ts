import { describe, expect, it } from 'vitest'
import { canPermanentlyDeleteGig, isPastGig } from '../shared/gig-rules'

describe('gig lifecycle rules', () => {
  it('only allows permanent deletion for declined gigs', () => {
    expect(canPermanentlyDeleteGig('declined')).toBe(true)
    expect(canPermanentlyDeleteGig('lead')).toBe(false)
    expect(canPermanentlyDeleteGig('booked')).toBe(false)
    expect(canPermanentlyDeleteGig('cancelled')).toBe(false)
  })

  it('derives past state from the gig date instead of a completed status', () => {
    const now = new Date('2026-09-19T12:00:00Z')
    expect(isPastGig('2026-09-18T20:00:00Z', now)).toBe(true)
    expect(isPastGig('2026-09-20T20:00:00Z', now)).toBe(false)
    expect(isPastGig(null, now)).toBe(false)
  })
})
