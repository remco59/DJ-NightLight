import { desc, eq } from 'drizzle-orm'
import { clients, gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Client id is required' })
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const history = await db
    .select({
      id: gigs.id,
      title: gigs.title,
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
