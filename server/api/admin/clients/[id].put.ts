import { eq } from 'drizzle-orm'
import { clients } from '../../../../db/schema'
import { clientInputSchema } from '../../../../shared/schemas/client'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = requireUuidParam(event, 'id')

  const input = await readValidatedBody(event, clientInputSchema.parse)
  const [client] = await db
    .update(clients)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning()

  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Klant niet gevonden' })
  }

  return { client }
})
