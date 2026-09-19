import { eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Landing page id is required' })

  const [deleted] = await db.delete(landingPages).where(eq(landingPages.id, id)).returning({ id: landingPages.id })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Landing page not found' })

  return { ok: true }
})
