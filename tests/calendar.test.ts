import { describe, expect, it } from 'vitest'
import {
  calendarRetryDelayMs,
  cancellationSummary,
  googleEventIdForGig,
  shouldHaveCalendarEvent,
} from '../shared/calendar'

describe('calendar synchronization rules', () => {
  it('creates a stable Google event id from a gig UUID', () => {
    const id = '3fb3da25-0f45-4ef4-9fa5-c62999437e27'
    expect(googleEventIdForGig(id)).toBe('nl3fb3da250f454ef49fa5c62999437e27')
    expect(googleEventIdForGig(id)).toBe(googleEventIdForGig(id))
  })

  it('only publishes booked gigs with a start time', () => {
    expect(shouldHaveCalendarEvent('booked', new Date())).toBe(true)
    expect(shouldHaveCalendarEvent('lead', new Date())).toBe(false)
    expect(shouldHaveCalendarEvent('booked', null)).toBe(false)
  })

  it('uses bounded exponential retry delays', () => {
    expect(calendarRetryDelayMs(0)).toBe(60_000)
    expect(calendarRetryDelayMs(1)).toBe(120_000)
    expect(calendarRetryDelayMs(20)).toBeLessThanOrEqual(6 * 60 * 60 * 1000)
  })

  it('does not double-prefix cancelled summaries', () => {
    expect(cancellationSummary('Wedding')).toBe('[Cancelled] Wedding')
    expect(cancellationSummary('[Cancelled] Wedding')).toBe('[Cancelled] Wedding')
  })
})
