import { desc, eq } from 'drizzle-orm'
import { clients, gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Venue id is required' })
  }

  const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Venue not found' })
  }

  const history = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      status: gigs.status,
      startsAt: gigs.startsAt,
      fee: gigs.fee,
      currency: gigs.currency,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientCompanyName: clients.companyName,
    })
    .from(gigs)
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .where(eq(gigs.venueId, id))
    .orderBy(desc(gigs.startsAt))

  return { venue, history }
})
