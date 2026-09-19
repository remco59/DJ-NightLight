import { clients } from '../../../../db/schema'
import { clientInputSchema } from '../../../../shared/schemas/client'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, clientInputSchema.parse)

  const [client] = await db.insert(clients).values(input).returning()
  event.node.res.statusCode = 201
  return { client }
})
