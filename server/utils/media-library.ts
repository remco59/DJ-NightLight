import { eq } from 'drizzle-orm'
import { landingPages, mediaAssets, siteContent } from '../../db/schema'
import { inspectImage } from '../../shared/media'
import { db } from './db'
import { getMediaStorage } from './media-storage'

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024

export async function storeMediaImage(input: {
  data: Uint8Array
  originalFilename: string
  thumbnail?: Uint8Array | null
  title?: string
  altText?: string
  tags?: string[]
  gigId?: string | null
  venueId?: string | null
}) {
  if (!input.data.length || input.data.length > MAX_MEDIA_BYTES) throw new Error('Image must be between 1 byte and 15 MB')
  const info = inspectImage(input.data)
  if (info.width > 12000 || info.height > 12000 || info.width * info.height > 80_000_000) {
    throw new Error('Image dimensions are too large')
  }

  const storage = getMediaStorage()
  const storageKey = await storage.put(input.data, info.extension, 'originals')
  let thumbnailKey: string | null = null
  try {
    if (input.thumbnail?.length) {
      if (input.thumbnail.length > MAX_THUMBNAIL_BYTES) throw new Error('Thumbnail exceeds 2 MB')
      const thumbnailInfo = inspectImage(input.thumbnail)
      if (thumbnailInfo.width > 1200 || thumbnailInfo.height > 1200) throw new Error('Thumbnail dimensions are too large')
      thumbnailKey = await storage.put(input.thumbnail, thumbnailInfo.extension, 'thumbnails')
    }
    const [asset] = await db.insert(mediaAssets).values({
      storageKey,
      thumbnailKey,
      originalFilename: input.originalFilename.slice(0, 255) || 'image',
      mimeType: info.mimeType,
      byteSize: input.data.length,
      width: info.width,
      height: info.height,
      title: input.title?.slice(0, 240) || '',
      altText: input.altText?.slice(0, 500) || '',
      tags: input.tags || [],
      gigId: input.gigId || null,
      venueId: input.venueId || null,
    }).returning()
    if (!asset) throw new Error('Media asset could not be created')
    return asset
  } catch (error) {
    await storage.delete(storageKey)
    await storage.delete(thumbnailKey)
    throw error
  }
}

export async function getMediaUsage(assetId: string) {
  const needle = `/api/media/${assetId}`
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1)
  if (!asset) return null
  const content = await db.select().from(siteContent)
  const pages = await db.select().from(landingPages)
  const references: string[] = []
  if (asset.gigId) references.push('Associated with a gig')
  if (asset.venueId) references.push('Associated with a venue')
  for (const row of content) {
    if (JSON.stringify(row).includes(needle)) references.push(`Website content: ${row.key}`)
  }
  for (const page of pages) {
    if (JSON.stringify(page).includes(needle)) references.push(`Landing page: ${page.slug}`)
  }
  return { asset, references: [...new Set(references)] }
}
