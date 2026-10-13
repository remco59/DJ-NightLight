import { and, eq, gte, isNull, lt } from 'drizzle-orm'
import { z } from 'zod'
import { gigs } from '../../../db/schema'
import { amsterdamDayWindow, gigStartsInWindow } from '../../../shared/gig-overlap'
import { db } from '../../utils/db'
import { assertRateLimit, requestClientKey } from '../../utils/rate-limit'

const DAY_MS = 24 * 60 * 60 * 1000

const availabilityQuerySchema = z.object({
  date: z.string().refine(value => amsterdamDayWindow(value) !== null, 'Ongeldige datum'),
})

/**
 * Whether the DJ is still free on a date. Only a yes/no is returned, never what is
 * planned. Confirmed bookings count; open leads do not.
 */
export default defineEventHandler(async (event) => {
  assertRateLimit(event, 'availability', requestClientKey(event))
  const { date } = await getValidatedQuery(event, availabilityQuerySchema.parse)
  const day = amsterdamDayWindow(date)!

  const rows = await db
    .select({ startsAt: gigs.startsAt, endsAt: gigs.endsAt, loadInAt: gigs.loadInAt })
    .from(gigs)
    .where(and(
      eq(gigs.status, 'booked'),
      isNull(gigs.deletedAt),
      // A gig can start the next morning while its load-in falls on this day.
      gte(gigs.startsAt, new Date(day.start)),
      lt(gigs.startsAt, new Date(day.end + DAY_MS)),
    ))

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { date, available: !rows.some(row => gigStartsInWindow(row, day)) }
})
