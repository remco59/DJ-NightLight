import { and, eq } from 'drizzle-orm'
import { quotes } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

/** Only a draft can be deleted. A sent quote is withdrawn with "laten vervallen" and keeps its number. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const [deleted] = await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.status, 'draft'))).returning({ id: quotes.id, gigId: quotes.gigId })
  if (!deleted) throw createError({ statusCode: 409, statusMessage: 'Alleen een concept kan worden verwijderd' })
  return { ok: true, gigId: deleted.gigId }
})
