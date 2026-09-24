import { count, eq } from 'drizzle-orm'
import { gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Locatie-ID is verplicht' })
  }

  const [usage] = await db.select({ value: count() }).from(gigs).where(eq(gigs.venueId, id))
  if ((usage?.value ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Deze locatie is gekoppeld aan een of meer gigs en kan niet worden verwijderd',
    })
  }

  const [deleted] = await db.delete(venues).where(eq(venues.id, id)).returning({ id: venues.id })
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Locatie niet gevonden' })
  }

  return { ok: true }
})
