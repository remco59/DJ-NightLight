import { desc, eq } from 'drizzle-orm'
import { clients, gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Locatie-ID is verplicht' })
  }

  const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Locatie niet gevonden' })
  }

  const history = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
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
