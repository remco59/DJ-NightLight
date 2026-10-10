import { describe, expect, it } from 'vitest'
import {
  addMonths,
  buildRevenueSeries,
  compareAttention,
  countdownLabel,
  daysBetween,
  gigUrgency,
  monthGrid,
  monthKey,
  revenueTrend,
} from '../shared/dashboard'

describe('dashboard helpers', () => {
  it('assigns a late-night gig to its Amsterdam month', () => {
    // 00:30 local on 1 November is still 31 October in UTC.
    expect(monthKey(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11')
    expect(monthKey(new Date('2026-10-17T19:00:00Z'))).toBe('2026-10')
  })

  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-10', 0)).toBe('2026-10')
  })

  it('counts calendar days, not 24-hour blocks', () => {
    const now = new Date('2026-10-05T21:00:00Z') // 23:00 on the 5th in Amsterdam
    expect(daysBetween(now, new Date('2026-10-05T22:30:00Z'))).toBe(1) // already the 6th locally
    expect(daysBetween(now, new Date('2026-10-17T19:00:00Z'))).toBe(12)
  })

  it('labels the countdown', () => {
    expect(countdownLabel(0)).toBe('vandaag')
    expect(countdownLabel(1)).toBe('morgen')
    expect(countdownLabel(12)).toBe('over 12 dagen')
    expect(countdownLabel(-1)).toBe('voorbij')
  })

  it('flags gigs that are close with open work', () => {
    expect(gigUrgency(3, 0)).toBe('normal')
    expect(gigUrgency(3, 1)).toBe('danger')
    expect(gigUrgency(7, 2)).toBe('danger')
    expect(gigUrgency(10, 1)).toBe('warn')
    expect(gigUrgency(30, 2)).toBe('normal')
  })

  it('builds a gapless revenue series around the current month', () => {
    const now = new Date('2026-10-05T10:00:00Z')
    const series = buildRevenueSeries([
      { startsAt: '2026-10-17T19:00:00Z', feeCents: 90_000 },
      { startsAt: '2026-10-21T16:30:00Z', feeCents: 10_000 },
      { startsAt: '2026-09-12T19:00:00Z', feeCents: 50_000 },
      { startsAt: '2026-11-28T20:00:00Z', feeCents: 70_000 },
      { startsAt: null, feeCents: 99_999 },
    ], now)
    expect(series).toHaveLength(12)
    expect(series[0]?.key).toBe('2026-05')
    expect(series.at(-1)?.key).toBe('2027-04')
    const byKey = Object.fromEntries(series.map(month => [month.key, month]))
    expect(byKey['2026-10']).toMatchObject({ cents: 100_000, current: true, future: false })
    expect(byKey['2026-09']?.cents).toBe(50_000)
    expect(byKey['2026-11']).toMatchObject({ cents: 70_000, future: true })
    expect(byKey['2026-08']?.cents).toBe(0)
  })

  it('compares with last month only when there is something to compare with', () => {
    expect(revenueTrend(150, 100)).toBe(50)
    expect(revenueTrend(50, 100)).toBe(-50)
    expect(revenueTrend(100, 0)).toBeNull()
  })

  it('lays out whole Monday-first weeks', () => {
    const grid = monthGrid('2026-10') // 1 October 2026 is a Thursday
    expect(grid).toHaveLength(35)
    expect(grid[0]).toMatchObject({ date: '2026-09-28', inMonth: false })
    expect(grid[3]).toMatchObject({ date: '2026-10-01', day: 1, inMonth: true })
    expect(grid.at(-1)).toMatchObject({ date: '2026-11-01', inMonth: false })
    expect(monthGrid('2027-02')).toHaveLength(28) // 1 Feb 2027 is a Monday and the month has 28 days
  })
})

describe('compareAttention', () => {
  it('sorts by urgency first, then oldest date, undated last', () => {
    const rows = [
      { id: 'lead', urgency: 'warn' as const, meta: null },
      { id: 'warn-late', urgency: 'warn' as const, meta: '2026-11-20' },
      { id: 'normal', urgency: 'normal' as const, meta: '2026-10-01' },
      { id: 'danger-late', urgency: 'danger' as const, meta: new Date('2026-10-20') },
      { id: 'danger-early', urgency: 'danger' as const, meta: '2026-10-12' },
      { id: 'warn-early', urgency: 'warn' as const, meta: '2026-10-25' },
    ]
    expect([...rows].sort(compareAttention).map(row => row.id)).toEqual(['danger-early', 'danger-late', 'warn-early', 'warn-late', 'lead', 'normal'])
  })
})
