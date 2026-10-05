import { and, asc, eq, gte, isNull } from 'drizzle-orm'
import { gigs, venues } from '../../../db/schema'
import { publicGigTitle } from '../../../shared/gig-title'
import { db } from '../../utils/db'
import { gigTitleSql } from '../../utils/gig-title'

/**
 * Venue name and city, without the street address. The venue name is left
 * out when the gig is already listed under it, so the line never repeats the title.
 */
function publicLocation(title: string, venueName: string | null, city: string | null) {
  const name = venueName?.trim()
  const parts = [name && name !== title ? name : null, city?.trim() || null].filter(Boolean)
  return parts.join(', ') || null
}

export default defineEventHandler(async () => {
  const rows = await db
    .select({
      title: gigTitleSql(),
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(venues, eq(venues.id, gigs.venueId))
    .where(and(
      eq(gigs.status, 'booked'),
      eq(gigs.publicVisibility, true),
      gte(gigs.startsAt, new Date()),
      isNull(gigs.deletedAt),
    ))
    .orderBy(asc(gigs.startsAt))
    .limit(50)

  return {
    gigs: rows.map((row) => {
      const title = publicGigTitle(row)
      return {
        title,
        description: row.publicDescription,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        location: publicLocation(title, row.venueName, row.venueCity),
      }
    }),
  }
})
