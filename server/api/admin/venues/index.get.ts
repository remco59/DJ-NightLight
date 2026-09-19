import { asc, count, ilike, isNull, or } from 'drizzle-orm'
import { gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const rows = await db
    .select()
    .from(venues)
    .where(search
      ? or(
          ilike(venues.name, `%${search}%`),
          ilike(venues.city, `%${search}%`),
          ilike(venues.contactName, `%${search}%`),
        )
      : undefined)
    .orderBy(asc(venues.name))

  const gigCounts = await db
    .select({ venueId: gigs.venueId, value: count() })
    .from(gigs)
    .where(isNull(gigs.deletedAt))
    .groupBy(gigs.venueId)

  const countMap = new Map(gigCounts.map(row => [row.venueId, row.value]))

  return {
    venues: rows.map(venue => ({
      ...venue,
      gigCount: countMap.get(venue.id) ?? 0,
    })),
  }
})
