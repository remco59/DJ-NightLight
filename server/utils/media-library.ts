import { desc, eq, inArray } from 'drizzle-orm'
import {
  generatedPosts,
  gigs,
  landingPages,
  mediaAssets,
  mediaCollectionItems,
  mediaCollections,
  siteContent,
  venues,
  videoProjects,
  videoRenderJobs,
} from '../../db/schema'
import { z } from 'zod'
import { inspectImage, inspectTimedMedia, mediaKindFromMime, type MediaAssetMetadata, type MediaSource } from '../../shared/media'
import {
  MEDIA_USAGE_LABELS,
  type MediaCollectionSummary,
  type MediaLibraryItem,
  type MediaUsage,
} from '../../shared/media-library'
import { db } from './db'
import { gigTitleSql } from './gig-title'
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
    throw new MediaValidationError(error instanceof Error ? error.message : 'Ongeldige afbeelding')
  }
}

/** Where a new asset comes from and which original it is a variant of. */
export type MediaPlacement = {
  source?: MediaSource
  parentAssetId?: string | null
  variantLabel?: string
  sourceUrl?: string
  collectionIds?: string[]
}

function placementColumns(input: MediaPlacement) {
  return {
    source: input.source || (input.parentAssetId ? 'derived' : 'upload'),
    parentAssetId: input.parentAssetId || null,
    variantLabel: input.variantLabel?.trim().slice(0, 80) || '',
  } as const
}

/**
 * Checks that `parentId` exists and that linking `assetId` under it would not
 * create a cycle (an original cannot become a variant of its own variant).
 */
export async function validateParentAsset(parentId: string | null | undefined, assetId?: string) {
  if (!parentId) return null
  if (parentId === assetId) throw new MediaValidationError('Een bestand kan geen variant van zichzelf zijn')
  let current: string | null = parentId
  for (let depth = 0; current && depth < 25; depth++) {
    const [row] = await db.select({ id: mediaAssets.id, parentAssetId: mediaAssets.parentAssetId })
      .from(mediaAssets).where(eq(mediaAssets.id, current)).limit(1)
    if (!row) throw new MediaValidationError(depth ? 'De keten van originelen is onderbroken' : 'Het originele bestand bestaat niet meer')
    if (assetId && row.parentAssetId === assetId) throw new MediaValidationError('Een origineel kan geen variant worden van zijn eigen variant')
    current = row.parentAssetId
  }
  return parentId
}

export async function addAssetsToCollections(assetIds: string[], collectionIds: string[]) {
  if (!assetIds.length || !collectionIds.length) return
  const existing = await db.select({ id: mediaCollections.id }).from(mediaCollections).where(inArray(mediaCollections.id, collectionIds))
  const rows = existing.flatMap(collection => assetIds.map(assetId => ({ collectionId: collection.id, assetId })))
  if (rows.length) await db.insert(mediaCollectionItems).values(rows).onConflictDoNothing()
}

export async function storeMediaImage(input: MediaPlacement & {
  data: Uint8Array
  originalFilename: string
  thumbnail?: Uint8Array | null
  title?: string
  altText?: string
  tags?: string[]
  gigId?: string | null
  venueId?: string | null
}) {
  if (!input.data.length || input.data.length > MAX_MEDIA_BYTES) throw new MediaValidationError('Een afbeelding moet tussen 1 byte en 15 MB zijn')
  const info = inspectUploadedImage(input.data)
  if (info.width > 12000 || info.height > 12000 || info.width * info.height > 80_000_000) {
    throw new MediaValidationError('De afmetingen van de afbeelding zijn te groot')
  }

  const storage = getMediaStorage()
  const storageKey = await storage.put(input.data, info.extension, 'originals')
  let thumbnailKey: string | null = null
  try {
    if (input.thumbnail?.length) {
      if (input.thumbnail.length > MAX_THUMBNAIL_BYTES) throw new MediaValidationError('De thumbnail is groter dan 2 MB')
      const thumbnailInfo = inspectUploadedImage(input.thumbnail)
      if (thumbnailInfo.width > 1200 || thumbnailInfo.height > 1200) throw new MediaValidationError('De afmetingen van de thumbnail zijn te groot')
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
      metadata: input.sourceUrl ? { sourceUrl: input.sourceUrl.slice(0, 2000) } : {},
      tags: input.tags || [],
      gigId: input.gigId || null,
      venueId: input.venueId || null,
      ...placementColumns(input),
    }).returning()
    if (!asset) throw new Error('Mediabestand aanmaken is niet gelukt')
    await addAssetsToCollections([asset.id], input.collectionIds || [])
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

export async function storeTimedMedia(input: MediaPlacement & {
  data: Uint8Array
  originalFilename: string
  metadata: unknown
  thumbnail?: Uint8Array | null
  title?: string
  altText?: string
  tags?: string[]
  gigId?: string | null
  venueId?: string | null
}) {
  let info
  try {
    info = inspectTimedMedia(input.data)
  } catch (error) {
    throw new MediaValidationError(error instanceof Error ? error.message : 'Ongeldig mediabestand')
  }
  const limit = info.kind === 'video' ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES
  if (input.data.length > limit) {
    throw new MediaValidationError(info.kind === 'video' ? 'Een video mag maximaal 250 MB zijn' : 'Audio mag maximaal 50 MB zijn')
  }
  const parsed = timedMetadataSchema.safeParse(input.metadata)
  if (!parsed.success) throw new MediaValidationError('De mediagegevens (duur en afmetingen) ontbreken of zijn ongeldig')
  const metadata: MediaAssetMetadata = {}
  if (parsed.data.peaks?.length) metadata.peaks = parsed.data.peaks.map(value => Math.round(value * 1000) / 1000)
  if (parsed.data.fps) metadata.fps = parsed.data.fps
  if (parsed.data.hasAudio !== undefined) metadata.hasAudio = parsed.data.hasAudio
  if (input.sourceUrl) metadata.sourceUrl = input.sourceUrl.slice(0, 2000)

  const storage = getMediaStorage()
  const storageKey = await storage.put(input.data, info.extension, 'originals')
  let thumbnailKey: string | null = null
  try {
    if (input.thumbnail?.length) {
      if (input.thumbnail.length > MAX_THUMBNAIL_BYTES) throw new MediaValidationError('De thumbnail is groter dan 2 MB')
      const thumbnailInfo = inspectUploadedImage(input.thumbnail)
      if (thumbnailInfo.width > 1200 || thumbnailInfo.height > 1200) throw new MediaValidationError('De afmetingen van de thumbnail zijn te groot')
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
      altText: input.altText?.slice(0, 500) || '',
      tags: input.tags || [],
      gigId: input.gigId || null,
      venueId: input.venueId || null,
      ...placementColumns(input),
    }).returning()
    if (!asset) throw new Error('Mediabestand aanmaken is niet gelukt')
    await addAssetsToCollections([asset.id], input.collectionIds || [])
    return asset
  } catch (error) {
    await storage.delete(storageKey)
    await storage.delete(thumbnailKey)
    throw error
  }
}

const MEDIA_URL_PATTERN = /\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

function mediaIdsInJson(value: unknown) {
  return new Set([...JSON.stringify(value).matchAll(MEDIA_URL_PATTERN)].map(match => match[1]!.toLowerCase()))
}

/**
 * Every place NightLight references media, keyed by asset id. Website,
 * landing pages, video projects and render jobs block deletion; a generated
 * post only remembers its source, so it is informational.
 */
export async function collectMediaUsage() {
  const usage = new Map<string, MediaUsage[]>()
  const add = (assetId: string, entry: Omit<MediaUsage, 'label'> & { label?: string }) => {
    const list = usage.get(assetId) || []
    const item = { ...entry, label: entry.label || MEDIA_USAGE_LABELS[entry.kind] }
    if (!list.some(existing => existing.kind === item.kind && existing.label === item.label)) list.push(item)
    usage.set(assetId, list)
  }

  for (const row of await db.select().from(siteContent)) {
    for (const id of mediaIdsInJson(row)) add(id, { kind: 'website', to: '/admin/content', blocking: true })
  }
  for (const page of await db.select().from(landingPages)) {
    for (const id of mediaIdsInJson(page)) {
      add(id, { kind: 'landing_page', label: `Landing page · ${page.navLabel || page.slug}`, to: `/admin/landing-pages/${page.id}`, blocking: true })
    }
  }
  const projects = await db.select({ id: videoProjects.id, name: videoProjects.name, project: videoProjects.project }).from(videoProjects)
  for (const project of projects) {
    for (const id of collectProjectAssetIds(project.project)) {
      add(id, { kind: 'video_project', label: `Video · ${project.name}`, to: `/admin/post-generator/video/${project.id}`, blocking: true })
    }
  }
  const renders = await db.selectDistinct({ id: videoRenderJobs.sourceMediaAssetId }).from(videoRenderJobs)
  for (const render of renders) {
    if (render.id) add(render.id, { kind: 'video_render', to: '/admin/post-generator', blocking: true })
  }
  const posts = await db.selectDistinct({ id: generatedPosts.sourceMediaAssetId }).from(generatedPosts)
  for (const post of posts) {
    if (post.id) add(post.id, { kind: 'post_generator', to: '/admin/post-generator', blocking: false })
  }
  return usage
}

export async function getMediaUsage(assetId: string) {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1)
  if (!asset) return null
  const usage = (await collectMediaUsage()).get(assetId) || []
  return {
    asset,
    usage,
    references: usage.filter(entry => entry.blocking).map(entry => entry.label),
  }
}

/**
 * Deletes assets that nothing depends on. Assets still in use are skipped and
 * reported with their references instead of failing the whole batch.
 */
export async function deleteMediaAssets(ids: string[]) {
  const usage = await collectMediaUsage()
  const rows = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, ids))
  const storage = getMediaStorage()
  const deleted: string[] = []
  const blocked: Array<{ id: string, references: string[] }> = []
  for (const row of rows) {
    const references = (usage.get(row.id) || []).filter(entry => entry.blocking).map(entry => entry.label)
    if (references.length) {
      blocked.push({ id: row.id, references })
      continue
    }
    await db.delete(mediaAssets).where(eq(mediaAssets.id, row.id))
    await storage.delete(row.storageKey)
    await storage.delete(row.thumbnailKey)
    deleted.push(row.id)
  }
  const missing = ids.filter(id => !rows.some(row => row.id === id))
  return { deleted, blocked, missing }
}

export function mediaAssetUrls(asset: { id: string, mimeType: string, thumbnailKey?: string | null, hasThumbnail?: boolean }) {
  const hasThumbnail = asset.hasThumbnail ?? Boolean(asset.thumbnailKey)
  return {
    url: `/api/media/${asset.id}`,
    thumbnailUrl: hasThumbnail || mediaKindFromMime(asset.mimeType) === 'image' ? `/api/media/${asset.id}?variant=thumb` : null,
  }
}

export const MEDIA_LIBRARY_LIMIT = 2000

/** The library listing shared by the Media page and every media picker. */
export async function listMediaLibrary() {
  const rows = await db.select({
    id: mediaAssets.id,
    originalFilename: mediaAssets.originalFilename,
    mimeType: mediaAssets.mimeType,
    byteSize: mediaAssets.byteSize,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    metadata: mediaAssets.metadata,
    title: mediaAssets.title,
    altText: mediaAssets.altText,
    tags: mediaAssets.tags,
    gigId: mediaAssets.gigId,
    venueId: mediaAssets.venueId,
    source: mediaAssets.source,
    parentAssetId: mediaAssets.parentAssetId,
    variantLabel: mediaAssets.variantLabel,
    createdAt: mediaAssets.createdAt,
    updatedAt: mediaAssets.updatedAt,
    thumbnailKey: mediaAssets.thumbnailKey,
    gigTitle: gigTitleSql(),
    gigStartsAt: gigs.startsAt,
    venueName: venues.name,
  }).from(mediaAssets)
    .leftJoin(gigs, eq(mediaAssets.gigId, gigs.id))
    .leftJoin(venues, eq(mediaAssets.venueId, venues.id))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(MEDIA_LIBRARY_LIMIT)

  const usage = await collectMediaUsage()
  const memberships = await db.select().from(mediaCollectionItems)
  const collectionIds = new Map<string, string[]>()
  for (const item of memberships) collectionIds.set(item.assetId, [...(collectionIds.get(item.assetId) || []), item.collectionId])
  const variantCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.parentAssetId) variantCounts.set(row.parentAssetId, (variantCounts.get(row.parentAssetId) || 0) + 1)
  }

  return rows.map(({ thumbnailKey, gigStartsAt, createdAt, updatedAt, ...row }): MediaLibraryItem & { metadata: MediaAssetMetadata, hasThumbnail: boolean } => ({
    ...row,
    gigStartsAt: gigStartsAt?.toISOString() || null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    hasThumbnail: Boolean(thumbnailKey),
    variantCount: variantCounts.get(row.id) || 0,
    collectionIds: collectionIds.get(row.id) || [],
    usage: usage.get(row.id) || [],
    ...mediaAssetUrls({ id: row.id, mimeType: row.mimeType, thumbnailKey }),
  }))
}

export async function listMediaCollections(assets: MediaLibraryItem[]): Promise<MediaCollectionSummary[]> {
  const collections = await db.select().from(mediaCollections).orderBy(mediaCollections.sortOrder, mediaCollections.name)
  return collections.map((collection) => {
    const members = assets.filter(asset => asset.collectionIds.includes(collection.id))
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      sortOrder: collection.sortOrder,
      itemCount: members.length,
      coverUrls: members.map(asset => asset.thumbnailUrl).filter((url): url is string => Boolean(url)).slice(0, 3),
    }
  })
}

/**
 * Files a generator's rendered image in the library as a generated variant of
 * its source photo, inheriting the source's gig, venue and tags.
 */
export async function storeGeneratedImage(input: {
  data: Uint8Array
  originalFilename: string
  title: string
  variantLabel: string
  parentAssetId: string | null
}) {
  const [parent] = input.parentAssetId
    ? await db.select().from(mediaAssets).where(eq(mediaAssets.id, input.parentAssetId)).limit(1)
    : []
  return storeMediaImage({
    data: input.data,
    originalFilename: input.originalFilename,
    title: input.title,
    altText: parent?.altText || '',
    tags: parent?.tags || [],
    gigId: parent?.gigId || null,
    venueId: parent?.venueId || null,
    source: 'generated',
    parentAssetId: parent?.id || null,
    variantLabel: input.variantLabel,
  })
}

/** Turns the case-insensitive unique name index violation into a readable 409. */
export function collectionConflict(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined
  const causeCode = typeof error === 'object' && error !== null && 'cause' in error
    ? ((error as { cause?: { code?: unknown } }).cause?.code)
    : undefined
  if (code === '23505' || causeCode === '23505') {
    return createError({ statusCode: 409, statusMessage: 'Er bestaat al een collectie met deze naam' })
  }
  return error
}
