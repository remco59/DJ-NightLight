import { and, asc, eq, gte, isNull } from 'drizzle-orm'
import { gigs } from '../../../db/schema'
import { publicGigTitle } from '../../../shared/gig-title'
import { db } from '../../utils/db'
import { gigTitleSql } from '../../utils/gig-title'

export default defineEventHandler(async () => {
  const rows = await db
    .select({
      title: gigTitleSql(),
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
    })
    .from(gigs)
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
