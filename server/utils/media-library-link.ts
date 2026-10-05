import { open, readFile, readdir, stat } from 'node:fs/promises'
import { eq, inArray } from 'drizzle-orm'
import { mediaAssets } from '../../db/schema'
import { inspectImage, inspectTimedMedia, type MediaAssetMetadata } from '../../shared/media'
import {
  LIBRARY_MAX_ENTRIES,
  libraryFileTooLarge,
  libraryKey,
  libraryLimitMessage,
  libraryMediaKind,
  libraryParentPath,
  isHiddenLibraryName,
  normalizeLibraryPath,
  type LibraryEntry,
  type LibraryListing,
} from '../../shared/media-library-browse'
import { db } from './db'
import {
  MAX_THUMBNAIL_BYTES,
  MediaValidationError,
  addAssetsToCollections,
} from './media-library'
import { audioPeaks, imageThumbnail, MediaProbeError, probeMedia, videoThumbnail } from './media-probe'
import { getLibraryStorage, getMediaStorage } from './media-storage'

// Linking a file from the server media folder: nothing is copied. The asset
// stores a `library:<path>` key, and only its thumbnail lives in uploads.

const IMAGE_HEAD_BYTES = 2 * 1024 * 1024
const TIMED_HEAD_BYTES = 64

function requireLibrary() {
  const library = getLibraryStorage()
  if (!library) throw new MediaValidationError('De servermap is niet ingesteld')
  return library
}

function relativePathOrThrow(input: unknown) {
  const path = normalizeLibraryPath(input)
  if (path === null) throw new MediaValidationError('Ongeldig pad in de servermap')
  return path
}

async function readHead(path: string, bytes: number) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function listLibraryDirectory(input: unknown, kind: 'image' | 'all' = 'all'): Promise<LibraryListing> {
  const library = getLibraryStorage()
  if (!library) return { enabled: false }
  const path = relativePathOrThrow(input)

  let directory: string
  let names: string[]
  try {
    directory = await library.realPath(path)
    names = await readdir(directory)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Deze map bestaat niet' })
  }

  const entries: LibraryEntry[] = []
  for (const name of names.sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }))) {
    if (isHiddenLibraryName(name)) continue
    const entryPath = path ? `${path}/${name}` : name
    try {
      // realPath rejects symlinks that point outside the root.
      const info = await stat(await library.realPath(entryPath))
      if (info.isDirectory()) {
        entries.push({ name, path: entryPath, kind: 'directory' })
      } else if (info.isFile()) {
        const mediaKind = libraryMediaKind(name)
        if (!mediaKind || (kind === 'image' && mediaKind !== 'image')) continue
        entries.push({
          name,
          path: entryPath,
          kind: 'file',
          mediaKind,
          size: info.size,
          modifiedAt: info.mtime.toISOString(),
          tooLarge: libraryFileTooLarge(mediaKind, info.size),
        })
      }
    } catch {
      // Broken or escaping symlinks and unreadable entries are simply not listed.
    }
  }

  const truncated = entries.length > LIBRARY_MAX_ENTRIES
  const shown = [
    ...entries.filter(entry => entry.kind === 'directory'),
    ...entries.filter(entry => entry.kind === 'file'),
  ].slice(0, LIBRARY_MAX_ENTRIES)

  const files = shown.filter(entry => entry.kind === 'file')
  if (files.length) {
    const linked = await db.select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
      .from(mediaAssets).where(inArray(mediaAssets.storageKey, files.map(entry => libraryKey(entry.path))))
    const byKey = new Map(linked.map(row => [row.storageKey, row.id]))
    for (const entry of files) entry.assetId = byKey.get(libraryKey(entry.path))
  }

  return { enabled: true, path, parent: libraryParentPath(path), entries: shown, truncated }
}

export type LinkLibraryInput = {
  path: string
  title?: string
  altText?: string
  tags?: string[]
  gigId?: string | null
  venueId?: string | null
  parentAssetId?: string | null
  variantLabel?: string
  collectionIds?: string[]
}

/** Links one file from the server media folder into the library, or returns the asset that already links it. */
export async function linkLibraryFile(input: LinkLibraryInput) {
  const library = requireLibrary()
  const relativePath = relativePathOrThrow(input.path)
  if (!relativePath) throw new MediaValidationError('Kies een bestand in de servermap')
  const storageKey = libraryKey(relativePath)
  const filename = relativePath.split('/').pop()!

  const [existing] = await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, storageKey)).limit(1)
  if (existing) return { asset: existing, alreadyLinked: true }

  const kindByName = libraryMediaKind(filename)
  if (!kindByName) throw new MediaValidationError('Gebruik JPEG, PNG, WebP, MP4, MOV, WebM, MP3, M4A, WAV of OGG')
  let realPath: string
  let info
  try {
    realPath = await library.realPath(relativePath)
    info = await stat(realPath)
  } catch {
    throw new MediaValidationError('Dit bestand bestaat niet (meer) in de servermap')
  }
  if (!info.isFile() || !info.size) throw new MediaValidationError('Dit is geen bruikbaar mediabestand')
  if (libraryFileTooLarge(kindByName, info.size)) {
    throw new MediaValidationError(libraryLimitMessage(kindByName))
  }

  let values: {
    mimeType: string
    width: number
    height: number
    durationMs: number | null
    metadata: MediaAssetMetadata
  }
  let thumbnail: Uint8Array | null = null
  try {
    if (kindByName === 'image') {
      const head = await readHead(realPath, Math.min(info.size, IMAGE_HEAD_BYTES))
      const image = inspectImage(head)
      if (image.width > 12000 || image.height > 12000 || image.width * image.height > 80_000_000) {
        throw new MediaValidationError('De afmetingen van de afbeelding zijn te groot')
      }
      values = { mimeType: image.mimeType, width: image.width, height: image.height, durationMs: null, metadata: {} }
      // Images are at most 15 MB, so reading one for its thumbnail is cheap.
      thumbnail = await imageThumbnail(await readFile(realPath))
    } else {
      const timed = inspectTimedMedia(await readHead(realPath, Math.min(info.size, TIMED_HEAD_BYTES)))
      if (timed.kind !== kindByName) throw new MediaValidationError('De extensie komt niet overeen met de inhoud van het bestand')
      const probe = await probeMedia(realPath)
      const metadata: MediaAssetMetadata = {}
      if (probe.fps) metadata.fps = probe.fps
      metadata.hasAudio = probe.hasAudio
      if (probe.hasAudio) {
        const peaks = await audioPeaks(realPath, probe.durationMs)
        if (peaks.length) metadata.peaks = peaks
      }
      values = { mimeType: timed.mimeType, width: probe.width, height: probe.height, durationMs: probe.durationMs, metadata }
      if (timed.kind === 'video') thumbnail = await videoThumbnail(realPath, probe.durationMs)
    }
  } catch (error) {
    if (error instanceof MediaValidationError) throw error
    if (error instanceof MediaProbeError) throw new MediaValidationError(error.message)
    throw new MediaValidationError(error instanceof Error ? error.message : 'Ongeldig mediabestand')
  }

  let thumbnailKey: string | null = null
  const storage = getMediaStorage()
  try {
    if (thumbnail?.length && thumbnail.length <= MAX_THUMBNAIL_BYTES) {
      thumbnailKey = await storage.put(thumbnail, 'jpg', 'thumbnails')
    }
    const [asset] = await db.insert(mediaAssets).values({
      storageKey,
      thumbnailKey,
      originalFilename: filename.slice(0, 255),
      mimeType: values.mimeType,
      byteSize: info.size,
      width: values.width,
      height: values.height,
      durationMs: values.durationMs,
      metadata: values.metadata,
      title: input.title?.slice(0, 240) || '',
      altText: input.altText?.slice(0, 500) || '',
      tags: input.tags || [],
      gigId: input.gigId || null,
      venueId: input.venueId || null,
      source: 'library',
      parentAssetId: input.parentAssetId || null,
      variantLabel: input.parentAssetId ? input.variantLabel?.trim().slice(0, 80) || '' : '',
    }).onConflictDoNothing({ target: mediaAssets.storageKey }).returning()
    if (!asset) {
      // Linked by a concurrent request in the meantime.
      await storage.delete(thumbnailKey)
      const [raced] = await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, storageKey)).limit(1)
      if (!raced) throw new Error('Mediabestand koppelen is niet gelukt')
      return { asset: raced, alreadyLinked: true }
    }
    await addAssetsToCollections([asset.id], input.collectionIds || [])
    return { asset, alreadyLinked: false }
  } catch (error) {
    await storage.delete(thumbnailKey)
    throw error
  }
}
