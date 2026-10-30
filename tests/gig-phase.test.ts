import { describe, expect, it } from 'vitest'
import { gigHasStarted, gigIsFinished } from '../shared/gig-phase'

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

describe('gigHasStarted', () => {
  const now = new Date('2026-11-01T20:00:00.000Z')

  it('is false before the start, true from the start on', () => {
    expect(gigHasStarted({ startsAt: '2026-11-01T20:00:01.000Z', endsAt: null }, now)).toBe(false)
    expect(gigHasStarted({ startsAt: '2026-11-01T20:00:00.000Z', endsAt: '2026-11-02T02:00:00.000Z' }, now)).toBe(true)
  })

  it('without a start, the end decides', () => {
    expect(gigHasStarted({ startsAt: null, endsAt: '2026-11-02T02:00:00.000Z' }, now)).toBe(false)
    expect(gigHasStarted({ startsAt: null, endsAt: '2026-11-01T01:00:00.000Z' }, now)).toBe(true)
    expect(gigHasStarted({ startsAt: null, endsAt: null }, now)).toBe(false)
  })
})
