// Pure helpers for the admin dashboard, shared by the API and the page so the
// numbers and labels cannot drift apart.

const TIME_ZONE = 'Europe/Amsterdam'

export type RevenueMonth = {
  /** `YYYY-MM` */
  key: string
  cents: number
  /** True for the month we are in; future months are forecasts of booked gigs. */
  current: boolean
  future: boolean
}

export type Urgency = 'danger' | 'warn' | 'normal'

const monthFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: TIME_ZONE })
const dayFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE })

/** `YYYY-MM` of a moment, in the DJ's time zone (a 00:30 gig belongs to its own month). */
export function monthKey(value: Date) {
  const parts = monthFormatter.formatToParts(value)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return `${year}-${month}`
}

/** `YYYY-MM-DD` of a moment, in the DJ's time zone. */
export function dayKey(value: Date) {
  return dayFormatter.format(value)
}

export function addMonths(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number) as [number, number]
  const index = year * 12 + (month - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Calendar days from `from` to `to`, by Amsterdam date (so 23:30 tonight is today, not tomorrow). */
export function daysBetween(from: Date, to: Date) {
  const a = Date.parse(`${dayKey(from)}T00:00:00Z`)
  const b = Date.parse(`${dayKey(to)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function countdownLabel(days: number) {
  if (days < 0) return 'voorbij'
  if (days === 0) return 'vandaag'
  if (days === 1) return 'morgen'
  return `over ${days} dagen`
}

/** A gig close by with work still open is urgent; one within a fortnight deserves a nudge. */
export function gigUrgency(daysUntil: number, openItems: number): Urgency {
  if (openItems === 0) return 'normal'
  if (daysUntil <= 7) return 'danger'
  if (daysUntil <= 14) return 'warn'
  return 'normal'
}

/**
 * Booked revenue per month for a window around `now`: `before` months back,
 * the current month, and `after` months ahead. Months without gigs are zero so
 * the chart never has holes.
 */
export function buildRevenueSeries(
  gigs: Array<{ startsAt: Date | string | null, feeCents: number }>,
  now: Date,
  before = 5,
  after = 6,
): RevenueMonth[] {
  const current = monthKey(now)
  const totals = new Map<string, number>()
  for (const gig of gigs) {
    if (!gig.startsAt) continue
    const key = monthKey(new Date(gig.startsAt))
    totals.set(key, (totals.get(key) ?? 0) + gig.feeCents)
  }
  const series: RevenueMonth[] = []
  for (let offset = -before; offset <= after; offset++) {
    const key = addMonths(current, offset)
    series.push({ key, cents: totals.get(key) ?? 0, current: offset === 0, future: offset > 0 })
  }
  return series
}

/** Change against last month as a whole percentage, or null when there is nothing to compare with. */
export function revenueTrend(currentCents: number, previousCents: number) {
  if (previousCents <= 0) return null
  return Math.round(((currentCents - previousCents) / previousCents) * 100)
}

export type CalendarCell = {
  /** `YYYY-MM-DD` */
  date: string
  day: number
  inMonth: boolean
}

/** Monday-first month grid, always whole weeks. `month` is `YYYY-MM`. */
export function monthGrid(month: string): CalendarCell[] {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  const first = new Date(Date.UTC(year, mon - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const total = Math.ceil((offset + daysInMonth) / 7) * 7
  const cells: CalendarCell[] = []
  for (let index = 0; index < total; index++) {
    const date = new Date(Date.UTC(year, mon - 1, 1 - offset + index))
    cells.push({
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === mon - 1,
    })
  }
  return cells
}

const urgencyRank: Record<Urgency, number> = { danger: 0, warn: 1, normal: 2 }

/** Attention rows: most urgent first, then the oldest date (due or event) first, undated rows last. */
export function compareAttention(
  a: { urgency: Urgency, meta: string | Date | null },
  b: { urgency: Urgency, meta: string | Date | null },
) {
  const byUrgency = urgencyRank[a.urgency] - urgencyRank[b.urgency]
  if (byUrgency !== 0) return byUrgency
  const time = (value: string | Date | null) => value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  const ta = time(a.meta)
  const tb = time(b.meta)
  return ta === tb ? 0 : ta < tb ? -1 : 1
}
