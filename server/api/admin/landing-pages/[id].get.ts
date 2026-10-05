import { eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const id = requireUuidParam(event, 'id')

  const [page] = await db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Landing page niet gevonden' })

  return { page }
})
