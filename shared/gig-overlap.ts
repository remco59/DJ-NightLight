/** Assumed length of a gig without an end time, so a start-only gig still blocks the evening. */
export const DEFAULT_GIG_HOURS = 5

const HOUR_MS = 60 * 60 * 1000
const TIME_ZONE = 'Europe/Amsterdam'

export type GigTimes = {
  startsAt: Date | string | null | undefined
  endsAt?: Date | string | null
  loadInAt?: Date | string | null
}

export type TimeWindow = { start: number, end: number }

function toTime(value: Date | string | null | undefined) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * The span a gig occupies: from load-in (or start) until the end time, or
 * `DEFAULT_GIG_HOURS` after the start when no usable end is known.
 * Returns null for a gig without a start.
 */
export function gigWindow(times: GigTimes): TimeWindow | null {
  const startsAt = toTime(times.startsAt)
  if (startsAt === null) return null
  const loadInAt = toTime(times.loadInAt)
  const endsAt = toTime(times.endsAt)
  const start = loadInAt !== null && loadInAt < startsAt ? loadInAt : startsAt
  const end = endsAt !== null && endsAt > startsAt ? endsAt : startsAt + DEFAULT_GIG_HOURS * HOUR_MS
  return { start, end }
}

/** Half-open comparison: a gig ending exactly when another starts does not overlap. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow) {
  return a.start < b.end && b.start < a.end
}

function amsterdamOffsetMs(utcTime: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcTime))
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return asUtc - Math.floor(utcTime / 1000) * 1000
}

function amsterdamMidnight(year: number, month: number, day: number) {
  const utcMidnight = Date.UTC(year, month - 1, day)
  const guess = utcMidnight - amsterdamOffsetMs(utcMidnight)
  return utcMidnight - amsterdamOffsetMs(guess)
}

/** The calendar day `YYYY-MM-DD` in the Netherlands as a time window, or null when it is not a real date. */
export function amsterdamDayWindow(date: string): TimeWindow | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return {
    start: amsterdamMidnight(year, month, day),
    end: amsterdamMidnight(year, month, day + 1),
  }
}

/** A gig counts for a day when it begins (load-in or start) on that day; an evening running past midnight does not block the next day. */
export function gigStartsInWindow(times: GigTimes, day: TimeWindow) {
  const window = gigWindow(times)
  return Boolean(window && window.start >= day.start && window.start < day.end)
}
