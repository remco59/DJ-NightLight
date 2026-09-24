import { and, asc, eq, gte, isNull } from 'drizzle-orm'
import { gigs, venues } from '../../../db/schema'
import { publicGigTitle } from '../../../shared/gig-title'
import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  const rows = await db
    .select({
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(
      eq(gigs.status, 'booked'),
      eq(gigs.publicVisibility, true),
      gte(gigs.startsAt, new Date()),
      isNull(gigs.deletedAt),
    ))
    .orderBy(asc(gigs.startsAt))
    .limit(50)

  return {
    gigs: rows.map(row => ({
      title: publicGigTitle(row),
      description: row.publicDescription,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    })),
  }
})
