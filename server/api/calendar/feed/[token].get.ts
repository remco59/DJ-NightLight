import { and, eq, isNull, isNotNull } from 'drizzle-orm'
import { gigs, venues } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { validIcsToken } from '../../../../utils/calendar-subscription'
import { gigTitleSql } from '../../../../utils/gig-title'

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'token') || ''
  const token = raw.endsWith('.ics') ? raw.slice(0, -4) : raw
  if (!token || !(await validIcsToken(token))) {
    throw createError({ statusCode: 404, statusMessage: 'Agenda niet gevonden' })
  }

  const rows = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(
      isNull(gigs.deletedAt),
      eq(gigs.status, 'booked'),
      isNotNull(gigs.startsAt),
    ))
    .orderBy(gigs.startsAt)

  const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '')
  const now = icsDate(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DJ NightLight//Agenda//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:DJ NightLight',
    'X-WR-TIMEZONE:Europe/Amsterdam',
  ]

  for (const gig of rows) {
    if (!gig.startsAt) continue
    const start = new Date(gig.startsAt)
    const end = gig.endsAt ? new Date(gig.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
    const location = [gig.venueName, gig.venueAddress, gig.venueCity].filter(Boolean).join(', ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:gig-${gig.id}@nightlight`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcs(gig.title)}`,
      ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
      ...(gig.eventType ? [`DESCRIPTION:${escapeIcs(`Type: ${gig.eventType}`)}`] : []),
      `URL:${escapeIcs(`${siteUrl}/admin/gigs/${gig.id}`)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'content-disposition', 'inline; filename="nightlight.ics"')
  setHeader(event, 'cache-control', 'private, max-age=300')
  return lines.join('\r\n')
})
