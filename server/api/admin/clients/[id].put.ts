import { eq } from 'drizzle-orm'
import { clients } from '../../../../db/schema'
import { clientInputSchema } from '../../../../shared/schemas/client'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Klant-ID is verplicht' })
  }

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
