import { and, asc, count, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(venues.name, `%${search}%`),
      ilike(venues.city, `%${search}%`),
      ilike(venues.contactName, `%${search}%`),
    )!)
  }
  if (typeof query.city === 'string' && query.city) conditions.push(eq(venues.city, query.city))

  const rows = await db
    .select()
    .from(venues)
    .where(and(...conditions))
    .orderBy(asc(venues.name))

  const cities = (await db.selectDistinct({ city: venues.city }).from(venues).where(sql`${venues.city} is not null and ${venues.city} <> ''`).orderBy(asc(venues.city)))
    .map(row => row.city as string)

  const gigCounts = await db
    .select({ venueId: gigs.venueId, value: count() })
    .from(gigs)
    .where(isNull(gigs.deletedAt))
    .groupBy(gigs.venueId)

  const countMap = new Map(gigCounts.map(row => [row.venueId, row.value]))

  let list = rows.map(venue => ({ ...venue, gigCount: countMap.get(venue.id) ?? 0 }))
  const hasContact = (venue: (typeof rows)[number]) => Boolean(venue.contactName || venue.contactEmail || venue.contactPhone)
  if (query.hasContact === 'true') list = list.filter(hasContact)
  if (query.hasContact === 'false') list = list.filter(venue => !hasContact(venue))
  if (query.hasGigs === 'true') list = list.filter(venue => venue.gigCount > 0)
  if (query.hasGigs === 'false') list = list.filter(venue => venue.gigCount === 0)
  if (query.sort === 'name_desc') list.reverse()
  if (query.sort === 'gigs_desc') list.sort((a, b) => b.gigCount - a.gigCount)

  return { venues: list, options: { cities } }
})
