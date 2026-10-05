import { describe, expect, it } from 'vitest'
import { gigIsFinished } from '../shared/gig-phase'

describe('gigIsFinished', () => {
  const now = new Date('2026-06-01T12:00:00Z')

  it('is finished once the end has passed', () => {
    expect(gigIsFinished({ startsAt: '2026-05-31T20:00:00Z', endsAt: '2026-06-01T02:00:00Z' }, now)).toBe(true)
  })

  it('is open while the gig is still running or upcoming', () => {
    expect(gigIsFinished({ startsAt: '2026-05-31T20:00:00Z', endsAt: '2026-06-02T02:00:00Z' }, now)).toBe(false)
  })

  it('falls back to the start and never finishes without a date', () => {
    expect(gigIsFinished({ startsAt: '2026-05-01T20:00:00Z', endsAt: null }, now)).toBe(true)
    expect(gigIsFinished({ startsAt: null, endsAt: null }, now)).toBe(false)
  })
})
