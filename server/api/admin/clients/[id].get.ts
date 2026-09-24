import { desc, eq } from 'drizzle-orm'
import { clients, gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Klant-ID is verplicht' })
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Klant niet gevonden' })
  }

  const history = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      status: gigs.status,
      startsAt: gigs.startsAt,
      fee: gigs.fee,
      currency: gigs.currency,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(eq(gigs.clientId, id))
    .orderBy(desc(gigs.startsAt))

  return { client, history }
})
