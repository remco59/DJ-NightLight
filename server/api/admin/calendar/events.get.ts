import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { gigs, users, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'dj'])
  const query = getQuery(event)
  const start = typeof query.start === 'string' ? new Date(query.start) : null
  const end = typeof query.end === 'string' ? new Date(query.end) : null

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw createError({ statusCode: 400, statusMessage: 'Ongeldige kalenderperiode' })
  }

  const conditions = [
    isNull(gigs.deletedAt),
    lt(gigs.startsAt, end),
    // Null end times are treated as short events. Otherwise include anything overlapping the range.
    or(isNull(gigs.endsAt), gt(gigs.endsAt, start))!,
  ]
  if (user.role === 'dj') conditions.push(eq(gigs.assignedUserId, user.id))

  const rows = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
      venueCity: venues.city,
      assignedUserId: gigs.assignedUserId,
      assignedUserName: users.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(users, eq(gigs.assignedUserId, users.id))
    .where(and(...conditions))
    .orderBy(gigs.startsAt)

  return { events: rows }
})
