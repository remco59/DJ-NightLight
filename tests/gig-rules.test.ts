import { describe, expect, it } from 'vitest'
import { canPermanentlyDeleteGig, gigRemovalMode, isPastGig } from '../shared/gig-rules'

describe('gig lifecycle rules', () => {
  it('only permanently deletes declined gigs without financial history', () => {
    expect(canPermanentlyDeleteGig('declined')).toBe(true)
    expect(canPermanentlyDeleteGig('declined', true)).toBe(false)
    expect(canPermanentlyDeleteGig('lead')).toBe(false)
    expect(canPermanentlyDeleteGig('booked')).toBe(false)
    expect(canPermanentlyDeleteGig('cancelled')).toBe(false)
  })

  it('archives declined gigs that have financial history', () => {
    expect(gigRemovalMode('declined', false)).toBe('delete')
    expect(gigRemovalMode('declined', true)).toBe('archive')
    expect(gigRemovalMode('lead', true)).toBeNull()
    expect(gigRemovalMode('booked', false)).toBeNull()
    expect(gigRemovalMode('cancelled', true)).toBeNull()
  })

  it('derives past state from the gig date instead of a completed status', () => {
    const now = new Date('2026-09-19T12:00:00Z')
    expect(isPastGig('2026-09-18T20:00:00Z', now)).toBe(true)
    expect(isPastGig('2026-09-20T20:00:00Z', now)).toBe(false)
    expect(isPastGig(null, now)).toBe(false)
  })
})
