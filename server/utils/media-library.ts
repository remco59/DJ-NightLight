import { eq } from 'drizzle-orm'
import { landingPages, mediaAssets, siteContent, videoProjects } from '../../db/schema'
import { z } from 'zod'
import { inspectImage, inspectTimedMedia, type MediaAssetMetadata } from '../../shared/media'
import { db } from './db'
import { collectProjectAssetIds } from '../../shared/video-project'
import { getMediaStorage } from './media-storage'

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaValidationError'
  }
}

function inspectUploadedImage(buffer: Uint8Array) {
  try {
    return inspectImage(buffer)
  } catch (error) {
    throw new MediaValidationError(error instanceof Error ? error.message : 'Invalid image')
  }
}

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
  if (!input.data.length || input.data.length > MAX_MEDIA_BYTES) throw new MediaValidationError('Image must be between 1 byte and 15 MB')
  const info = inspectUploadedImage(input.data)
  if (info.width > 12000 || info.height > 12000 || info.width * info.height > 80_000_000) {
    throw new MediaValidationError('Image dimensions are too large')
  }

  const storage = getMediaStorage()
  const storageKey = await storage.put(input.data, info.extension, 'originals')
  let thumbnailKey: string | null = null
  try {
    if (input.thumbnail?.length) {
      if (input.thumbnail.length > MAX_THUMBNAIL_BYTES) throw new MediaValidationError('Thumbnail exceeds 2 MB')
      const thumbnailInfo = inspectUploadedImage(input.thumbnail)
      if (thumbnailInfo.width > 1200 || thumbnailInfo.height > 1200) throw new MediaValidationError('Thumbnail dimensions are too large')
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

export function isImageUpload(buffer: Uint8Array) {
  try {
    inspectImage(buffer)
    return true
  } catch {
    return false
  }
}

// Browsers probe duration, dimensions and waveform peaks client-side (the
// server has no ffprobe); values are bounded so bad input cannot bloat rows.
const timedMetadataSchema = z.object({
  durationMs: z.number().int().min(1).max(6 * 60 * 60 * 1000),
  width: z.number().int().min(0).max(8192).default(0),
  height: z.number().int().min(0).max(8192).default(0),
  fps: z.number().min(1).max(240).optional(),
  hasAudio: z.boolean().optional(),
  peaks: z.array(z.number().min(0).max(1)).max(1000).optional(),
})

export async function storeTimedMedia(input: {
  data: Uint8Array
  originalFilename: string
  metadata: unknown
  thumbnail?: Uint8Array | null
  title?: string
  tags?: string[]
  gigId?: string | null
  venueId?: string | null
}) {
  let info
  try {
    info = inspectTimedMedia(input.data)
  } catch (error) {
    throw new MediaValidationError(error instanceof Error ? error.message : 'Invalid media file')
  }
  const limit = info.kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
  if (input.data.length > limit) {
    throw new MediaValidationError(info.kind === 'video' ? 'Video must be 250 MB or smaller' : 'Audio must be 50 MB or smaller')
  }
  const parsed = timedMetadataSchema.safeParse(input.metadata)
  if (!parsed.success) throw new MediaValidationError('Media metadata (duration and dimensions) is missing or invalid')
  const metadata: MediaAssetMetadata = {}
  if (parsed.data.peaks?.length) metadata.peaks = parsed.data.peaks.map(value => Math.round(value * 1000) / 1000)
  if (parsed.data.fps) metadata.fps = parsed.data.fps
  if (parsed.data.hasAudio !== undefined) metadata.hasAudio = parsed.data.hasAudio

  const storage = getMediaStorage()
  const storageKey = await storage.put(input.data, info.extension, 'originals')
  let thumbnailKey: string | null = null
  try {
    if (input.thumbnail?.length) {
      if (input.thumbnail.length > MAX_THUMBNAIL_BYTES) throw new MediaValidationError('Thumbnail exceeds 2 MB')
      const thumbnailInfo = inspectUploadedImage(input.thumbnail)
      if (thumbnailInfo.width > 1200 || thumbnailInfo.height > 1200) throw new MediaValidationError('Thumbnail dimensions are too large')
      thumbnailKey = await storage.put(input.thumbnail, thumbnailInfo.extension, 'thumbnails')
    }
    const [asset] = await db.insert(mediaAssets).values({
      storageKey,
      thumbnailKey,
      originalFilename: input.originalFilename.slice(0, 255) || info.kind,
      mimeType: info.mimeType,
      byteSize: input.data.length,
      width: info.kind === 'video' ? parsed.data.width : 0,
      height: info.kind === 'video' ? parsed.data.height : 0,
      durationMs: parsed.data.durationMs,
      metadata,
      title: input.title?.slice(0, 240) || '',
      altText: '',
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
  const projects = await db.select({ name: videoProjects.name, project: videoProjects.project }).from(videoProjects)
  for (const project of projects) {
    if (collectProjectAssetIds(project.project).includes(assetId)) references.push(`Video project: ${project.name}`)
  }
  return { asset, references: [...new Set(references)] }
}
