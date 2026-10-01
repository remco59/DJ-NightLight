// Public dates are always shown in Dutch time. Without an explicit time zone
// the server renders UTC (19:00) and the browser then corrects it (21:00).
const TIME_ZONE = 'Europe/Amsterdam'

function format(value: string | Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('nl-NL', { ...options, timeZone: TIME_ZONE }).format(new Date(value))
}

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function dutchDayOfMonth(value: string | Date) {
  return Number(format(value, { day: 'numeric' }))
}

export function dutchMonthShort(value: string | Date) {
  return format(value, { month: 'short' }).replace('.', '')
}

export function dutchYear(value: string | Date) {
  return Number(format(value, { year: 'numeric' }))
}

/** "Zaterdag 17 oktober 2026": only the first letter is a capital, as in Dutch. */
export function dutchFullDate(value: string | Date) {
  return capitalizeFirst(format(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

export function dutchShortDate(value: string | Date) {
  return format(value, { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
}

export function dutchTime(value: string | Date) {
  return format(value, { hour: '2-digit', minute: '2-digit' })
}

export function dutchTimeRange(start: string | Date, end: string | Date | null) {
  return end ? `${dutchTime(start)} – ${dutchTime(end)}` : dutchTime(start)
}

/** "Zaterdag 17 oktober 2026 om 21:00" for a date with a time. */
export function dutchDateTime(value: string | Date) {
  return `${dutchFullDate(value)} om ${dutchTime(value)}`
}
