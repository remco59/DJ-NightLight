import { eq } from 'drizzle-orm'
import { mediaAssets } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { getMediaUsage } from '../../../utils/media-library'
import { getMediaStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media-ID is verplicht' })

  const usage = await getMediaUsage(id)
  if (!usage) throw createError({ statusCode: 404, statusMessage: 'Mediabestand niet gevonden' })
  if (usage.references.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Het mediabestand wordt nog gebruikt',
      data: { references: usage.references },
    })
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id))
  const storage = getMediaStorage()
  await storage.delete(usage.asset.storageKey)
  await storage.delete(usage.asset.thumbnailKey)
  return { ok: true }
})
