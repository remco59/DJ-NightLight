// Fills the gig announce templates from a gig in the agenda. The editor offers
// the upcoming gigs in a picker; the fields stay editable, so a gig is only a
// starting point and "manual" keeps whatever the user typed.

import type { GraphicItem } from './video-project'
import { MOTION_TEMPLATES, type MotionTemplateKey, type TemplateProps } from './video-templates'

/** The gig data a template may use: nothing internal (fees, notes, client). */
export type TemplateGig = {
  id: string
  /** Public title when set, otherwise the gig title. */
  title: string
  startsAt: string | Date
  endsAt: string | Date | null
  venueName: string | null
  venueCity: string | null
  publicVisibility: boolean
}

/** `single` templates announce one gig, `list` templates show the next few. */
export const GIG_TEMPLATES: Partial<Record<MotionTemplateKey, 'single' | 'list'>> = {
  'gig-announcement': 'single',
  'electric-gig-poster': 'single',
  'upcoming-gigs': 'list',
}

export function gigTemplateKind(key: MotionTemplateKey) {
  return GIG_TEMPLATES[key] || null
}

const TIME_ZONE = 'Europe/Amsterdam'
const WEEKDAYS = ['ZON', 'MAA', 'DIN', 'WOE', 'DON', 'VRI', 'ZAT']
const MONTHS = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Wall-clock parts in the Netherlands, wherever the editor or server runs. */
function localParts(value: string | Date) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return {
    weekday: WEEKDAYS[WEEKDAY_INDEX[parts.weekday || ''] ?? 0]!,
    day: Number(parts.day),
    month: MONTHS[Number(parts.month) - 1]!,
    time: `${parts.hour}:${parts.minute}`,
  }
}

const pad = (day: number) => String(day).padStart(2, '0')
const city = (gig: TemplateGig) => gig.venueCity?.trim() || ''

function timeRange(gig: TemplateGig, separator: string) {
  const start = localParts(gig.startsAt).time
  return gig.endsAt ? `${start}${separator}${localParts(gig.endsAt).time}` : start
}

/** "06 DEC" style label, as used in the picker and the Upcoming Gigs rows. */
export function gigDateLabel(gig: TemplateGig) {
  const { day, month } = localParts(gig.startsAt)
  return `${pad(day)} ${month}`
}

export function gigPickerLabel(gig: TemplateGig) {
  const { weekday } = localParts(gig.startsAt)
  const place = [gig.venueName, gig.venueCity].filter(Boolean).join(', ')
  return [`${weekday} ${gigDateLabel(gig)}`, gig.title, place].filter(Boolean).join(' · ')
    + (gig.publicVisibility ? '' : ' (not public)')
}

/** One "date | title | place" row for the Upcoming Gigs template. */
export function gigListRow(gig: TemplateGig) {
  return [gigDateLabel(gig), gig.title, gig.venueCity || gig.venueName || ''].join(' | ')
}

/** The template fields a gig fills in; other fields (headline, CTA, icons) are left alone. */
export function gigTemplateProps(key: MotionTemplateKey, gig: TemplateGig): TemplateProps {
  const { weekday, day, month } = localParts(gig.startsAt)
  const venue = (gig.venueName || gig.title).toUpperCase()
  if (key === 'gig-announcement') {
    return clamp(key, {
      venue,
      date: `${weekday} ${day} ${month}`,
      time: timeRange(gig, ' - '),
      location: gig.venueCity || '',
    })
  }
  if (key === 'electric-gig-poster') {
    return clamp(key, {
      day: String(day),
      month,
      venue: venue.includes(city(gig).toUpperCase()) ? venue : `${venue} · ${city(gig).toUpperCase()}`,
      time: timeRange(gig, ' – '),
    })
  }
  return {}
}

/** Rows for the Upcoming Gigs template: the next gigs, as many as it shows. */
export function gigListProps(gigs: TemplateGig[]): TemplateProps {
  const field = MOTION_TEMPLATES['upcoming-gigs'].fields.find(entry => entry.key === 'gigs')
  return { gigs: gigs.slice(0, field?.maxItems || 6).map(gig => gigListRow(gig).slice(0, field?.maxLength || 120)) }
}

const GIG_FIELDS: Partial<Record<MotionTemplateKey, string[]>> = {
  'gig-announcement': ['venue', 'date', 'time', 'location'],
  'electric-gig-poster': ['day', 'month', 'venue', 'time'],
}

/** Keys a gig overwrites; editing one of them by hand turns the item back to manual. */
export function gigFieldKeys(key: MotionTemplateKey) {
  return GIG_FIELDS[key] || []
}

function clamp(key: MotionTemplateKey, props: Record<string, string>): TemplateProps {
  const fields = MOTION_TEMPLATES[key].fields
  return Object.fromEntries(Object.entries(props).map(([name, value]) => {
    const max = fields.find(field => field.key === name)?.maxLength
    return [name, max ? value.slice(0, max) : value]
  }))
}

/** Gigs that have not ended yet, in the order given (the API sorts by start). */
export function upcomingGigs(gigs: TemplateGig[], now = new Date()) {
  return gigs.filter(gig => new Date(gig.endsAt || gig.startsAt).getTime() >= now.getTime())
}

/**
 * Fills a freshly created template with the agenda: the next gig for a single
 * announcement (linked by `gigId`), the next few for a list. Returns the
 * patched props and link, or null when the template does not use gigs.
 */
export function gigDefaults(key: MotionTemplateKey, gigs: TemplateGig[], now = new Date()) {
  const kind = gigTemplateKind(key)
  const upcoming = upcomingGigs(gigs, now)
  if (kind === 'list' && upcoming.length) return { props: gigListProps(upcoming), gigId: undefined }
  const gig = kind === 'single' ? upcoming[0] : null
  return gig ? { props: gigTemplateProps(key, gig), gigId: gig.id } : null
}

/** Applies `gigDefaults` to a new graphic item in place. */
export function applyGigDefaults(item: GraphicItem, gigs: TemplateGig[], now = new Date()) {
  const filled = gigDefaults(item.templateKey, gigs, now)
  if (!filled) return item
  Object.assign(item.templateProps, filled.props)
  if (filled.gigId) item.gigId = filled.gigId
  return item
}
