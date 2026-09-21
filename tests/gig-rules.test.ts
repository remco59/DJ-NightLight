import { describe, expect, it } from 'vitest'
import { canPermanentlyDeleteGig, gigRemovalMode, isPastGig } from '../shared/gig-rules'

describe('gig lifecycle rules', () => {
  it('only allows permanent deletion for declined gigs', () => {
    expect(canPermanentlyDeleteGig('declined')).toBe(true)
    expect(canPermanentlyDeleteGig('lead')).toBe(false)
    expect(canPermanentlyDeleteGig('booked')).toBe(false)
    expect(canPermanentlyDeleteGig('cancelled')).toBe(false)
  })

  it('chooses permanent deletion for declined gigs without financial history', () => {
    expect(gigRemovalMode('declined', false)).toBe('delete')
  })

  it('archives declined gigs when financial history must be retained', () => {
    expect(gigRemovalMode('declined', true)).toBe('archive')
  })

  it('does not allow removal for active gig states', () => {
    expect(gigRemovalMode('lead', false)).toBeNull()
    expect(gigRemovalMode('booked', true)).toBeNull()
    expect(gigRemovalMode('cancelled', false)).toBeNull()
  })

  it('derives past state from the gig date instead of a completed status', () => {
    const now = new Date('2026-09-19T12:00:00Z')
    expect(isPastGig('2026-09-18T20:00:00Z', now)).toBe(true)
    expect(isPastGig('2026-09-20T20:00:00Z', now)).toBe(false)
    expect(isPastGig(null, now)).toBe(false)
  })
})
