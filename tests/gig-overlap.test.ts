import { describe, expect, it } from 'vitest'
import { amsterdamDayWindow, DEFAULT_GIG_HOURS, gigStartsInWindow, gigWindow, windowsOverlap } from '../shared/gig-overlap'

const at = (iso: string) => new Date(iso).getTime()

describe('gig window', () => {
  it('runs from start to end', () => {
    expect(gigWindow({ startsAt: '2026-09-21T18:00:00.000Z', endsAt: '2026-09-21T22:00:00.000Z' }))
      .toEqual({ start: at('2026-09-21T18:00:00.000Z'), end: at('2026-09-21T22:00:00.000Z') })
  })

  it('starts at load-in when that is earlier', () => {
    expect(gigWindow({ startsAt: '2026-09-21T18:00:00.000Z', endsAt: '2026-09-21T22:00:00.000Z', loadInAt: '2026-09-21T16:00:00.000Z' })?.start)
      .toBe(at('2026-09-21T16:00:00.000Z'))
  })

  it('assumes a default length without an end time', () => {
    const window = gigWindow({ startsAt: '2026-09-21T18:00:00.000Z' })
    expect(window?.end).toBe(at('2026-09-21T18:00:00.000Z') + DEFAULT_GIG_HOURS * 3600_000)
  })

  it('ignores an end before the start', () => {
    expect(gigWindow({ startsAt: '2026-09-21T18:00:00.000Z', endsAt: '2026-09-21T17:00:00.000Z' })?.end)
      .toBe(at('2026-09-21T18:00:00.000Z') + DEFAULT_GIG_HOURS * 3600_000)
  })

  it('is null without a usable start', () => {
    expect(gigWindow({ startsAt: null })).toBeNull()
    expect(gigWindow({ startsAt: 'not-a-date' })).toBeNull()
  })
})

describe('windows overlap', () => {
  const a = { start: 10, end: 20 }
  it('detects overlap', () => {
    expect(windowsOverlap(a, { start: 15, end: 25 })).toBe(true)
    expect(windowsOverlap(a, { start: 12, end: 14 })).toBe(true)
  })
  it('treats touching windows as separate', () => {
    expect(windowsOverlap(a, { start: 20, end: 30 })).toBe(false)
    expect(windowsOverlap(a, { start: 0, end: 10 })).toBe(false)
  })
})

describe('amsterdam day window', () => {
  it('covers a winter day in CET', () => {
    expect(amsterdamDayWindow('2026-01-15')).toEqual({ start: at('2026-01-14T23:00:00.000Z'), end: at('2026-01-15T23:00:00.000Z') })
  })

  it('covers a summer day in CEST', () => {
    expect(amsterdamDayWindow('2026-07-15')).toEqual({ start: at('2026-07-14T22:00:00.000Z'), end: at('2026-07-15T22:00:00.000Z') })
  })

  it('handles the 23 hour day when summer time starts', () => {
    const window = amsterdamDayWindow('2026-03-29')!
    expect(window.start).toBe(at('2026-03-28T23:00:00.000Z'))
    expect(window.end).toBe(at('2026-03-29T22:00:00.000Z'))
  })

  it('handles the 25 hour day when summer time ends', () => {
    const window = amsterdamDayWindow('2026-10-25')!
    expect(window.start).toBe(at('2026-10-24T22:00:00.000Z'))
    expect(window.end).toBe(at('2026-10-25T23:00:00.000Z'))
  })

  it('rejects malformed and impossible dates', () => {
    expect(amsterdamDayWindow('2026-02-30')).toBeNull()
    expect(amsterdamDayWindow('15-01-2026')).toBeNull()
    expect(amsterdamDayWindow('')).toBeNull()
  })
})

describe('gig starts in day', () => {
  const day = amsterdamDayWindow('2026-07-15')!

  it('counts an evening gig on that day', () => {
    expect(gigStartsInWindow({ startsAt: '2026-07-15T18:00:00.000Z' }, day)).toBe(true)
  })

  it('does not block the next day for an evening running past midnight', () => {
    const next = amsterdamDayWindow('2026-07-16')!
    expect(gigStartsInWindow({ startsAt: '2026-07-15T20:00:00.000Z', endsAt: '2026-07-16T02:00:00.000Z' }, next)).toBe(false)
  })

  it('ignores gigs without a date', () => {
    expect(gigStartsInWindow({ startsAt: null }, day)).toBe(false)
  })
})
