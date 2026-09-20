import { eq } from 'drizzle-orm'
import { mediaAssets } from '../../../db/schema'
import { db } from '../../utils/db'
import { getMediaStorage } from '../../utils/media-storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media id is required' })
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Media asset not found' })

  const variant = String(getQuery(event).variant || 'original')
  const useThumbnail = variant === 'thumb' && Boolean(asset.thumbnailKey)
  const key = useThumbnail ? asset.thumbnailKey! : asset.storageKey
  try {
    const data = await getMediaStorage().read(key)
    setHeader(event, 'content-type', useThumbnail ? 'image/jpeg' : asset.mimeType)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Stored media file is missing' })
  }
})
