import { describe, expect, it } from 'vitest'
import { gigEndFromDuration } from '../shared/gig-duration'

describe('gig duration', () => {
  it('calculates an end time from start and decimal hours', () => {
    expect(gigEndFromDuration('2026-09-21T18:00:00.000Z', 4.5)?.toISOString())
      .toBe('2026-09-21T22:30:00.000Z')
  })

  it('accepts comma decimals from user-entered duration values', () => {
    expect(gigEndFromDuration('2026-09-21T18:00:00.000Z', '2,25')?.toISOString())
      .toBe('2026-09-21T20:15:00.000Z')
  })

  it('returns null when start or duration is unusable', () => {
    expect(gigEndFromDuration('', '4')).toBeNull()
    expect(gigEndFromDuration('2026-09-21T18:00:00.000Z', '')).toBeNull()
    expect(gigEndFromDuration('2026-09-21T18:00:00.000Z', '0')).toBeNull()
    expect(gigEndFromDuration('not-a-date', '4')).toBeNull()
  })
})
