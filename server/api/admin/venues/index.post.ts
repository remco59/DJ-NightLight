import { venues } from '../../../../db/schema'
import { venueInputSchema } from '../../../../shared/schemas/venue'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, venueInputSchema.parse)

  const [venue] = await db.insert(venues).values(input).returning()
  setResponseStatus(event, 201)
  return { venue }
})
