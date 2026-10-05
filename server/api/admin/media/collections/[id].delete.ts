import { eq } from 'drizzle-orm'
import { mediaCollections } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** Removes the grouping only; the assets themselves stay in the library. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = requireUuidParam(event, 'id')
  const [collection] = await db.delete(mediaCollections).where(eq(mediaCollections.id, id)).returning({ id: mediaCollections.id })
  if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collectie niet gevonden' })
  return { ok: true }
})
