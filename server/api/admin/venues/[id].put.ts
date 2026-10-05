import { eq } from 'drizzle-orm'
import { venues } from '../../../../db/schema'
import { venueInputSchema } from '../../../../shared/schemas/venue'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Locatie-ID is verplicht' })
  }

  const input = await readValidatedBody(event, venueInputSchema.parse)
  const [venue] = await db
    .update(venues)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(venues.id, id))
    .returning()

  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Locatie niet gevonden' })
  }

  return { venue }
})
