import { eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const id = requireUuidParam(event, 'id')

  const [deleted] = await db.delete(landingPages).where(eq(landingPages.id, id)).returning({ id: landingPages.id })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Landing page niet gevonden' })

  return { ok: true }
})
