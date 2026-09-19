import { count, eq } from 'drizzle-orm'
import { gigs, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Venue id is required' })
  }

  const [usage] = await db.select({ value: count() }).from(gigs).where(eq(gigs.venueId, id))
  if ((usage?.value ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This venue is used by one or more gigs and cannot be deleted',
    })
  }

  const [deleted] = await db.delete(venues).where(eq(venues.id, id)).returning({ id: venues.id })
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Venue not found' })
  }

  return { ok: true }
})
