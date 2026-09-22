import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { gigs, venues } from '../../../db/schema'
import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  const rows = await db
    .select({
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      startsAt: gigs.startsAt,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(
      eq(gigs.status, 'booked'),
      eq(gigs.publicVisibility, true),
      lt(gigs.startsAt, new Date()),
      isNull(gigs.deletedAt),
    ))
    .orderBy(desc(gigs.startsAt))
    .limit(3)

  return {
    gigs: rows.map(row => ({
      title: row.publicTitle || 'DJ NightLight',
      description: row.publicDescription,
      startsAt: row.startsAt,
      venue: row.venueName,
      city: row.venueCity,
    })),
  }
})
