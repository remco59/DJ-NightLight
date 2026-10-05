import { describe, expect, it } from 'vitest'
import { dutchDateTime, dutchDayOfMonth, dutchFullDate, dutchTimeRange } from '../shared/dutch-date'

describe('Dutch public dates', () => {
  it('shows times in Europe/Amsterdam regardless of the server time zone', () => {
    // 19:00 UTC on 17 October is 21:00 in Amsterdam (summer time).
    expect(dutchTimeRange('2026-10-17T19:00:00Z', '2026-10-17T23:00:00Z')).toBe('21:00 – 01:00')
    // Late UTC evening is already the next day in Amsterdam.
    expect(dutchDayOfMonth('2026-12-31T23:30:00Z')).toBe(1)
  })

  it('capitalizes only the first letter', () => {
    expect(dutchFullDate('2026-10-17T19:00:00Z')).toBe('Zaterdag 17 oktober 2026')
    expect(dutchDateTime('2026-10-17T19:00:00Z')).toBe('Zaterdag 17 oktober 2026 om 21:00')
  })
})
