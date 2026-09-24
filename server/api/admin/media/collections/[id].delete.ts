import { eq } from 'drizzle-orm'
import { mediaCollections } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

/** Removes the grouping only; the assets themselves stay in the library. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Collectie-ID is verplicht' })
  const [collection] = await db.delete(mediaCollections).where(eq(mediaCollections.id, id)).returning({ id: mediaCollections.id })
  if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collectie niet gevonden' })
  return { ok: true }
})
