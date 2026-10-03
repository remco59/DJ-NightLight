import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { mediaAssets } from '../../../db/schema'
import { db } from '../../utils/db'
import { assetFilePath, getMediaStorage, readAssetFile } from '../../utils/media-storage'
import { isLibraryKey } from '../../../shared/media-library-browse'
import { canResizeImage, getImageVariant, isResponsiveWidth } from '../../utils/media-variants'

/** Parses a single `bytes=start-end` range; null when absent or unsatisfiable. */
function parseRange(header: string | undefined, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() || '')
  if (!match || (!match[1] && !match[2])) return null
  let start = match[1] ? Number(match[1]) : size - Number(match[2])
  let end = match[1] && match[2] ? Number(match[2]) : size - 1
  start = Math.max(0, start)
  end = Math.min(size - 1, end)
  if (start > end || start >= size) return null
  return { start, end }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media-ID is verplicht' })
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Mediabestand niet gevonden' })

  const query = getQuery(event)
  const variant = String(query.variant || 'original')
  const useThumbnail = variant === 'thumb' && Boolean(asset.thumbnailKey)
  const key = useThumbnail ? asset.thumbnailKey! : asset.storageKey
  const storage = getMediaStorage()
  // Linked files can change on disk, so they get a short cache lifetime instead of `immutable`.
  const linked = !useThumbnail && isLibraryKey(asset.storageKey)
  const cacheControl = linked ? 'public, max-age=300' : 'public, max-age=31536000, immutable'

  if (!query.download && query.w !== undefined && isResponsiveWidth(query.w) && canResizeImage(asset.mimeType)) {
    try {
      const version = isLibraryKey(asset.storageKey) ? String(Math.floor((await stat(await assetFilePath(asset.storageKey))).mtimeMs)) : ''
      const data = await getImageVariant(asset, Number(query.w), version)
      setHeader(event, 'content-type', 'image/webp')
      setHeader(event, 'cache-control', isLibraryKey(asset.storageKey) ? 'public, max-age=300' : 'public, max-age=31536000, immutable')
      setHeader(event, 'content-length', data.length)
      return data
    } catch {
      // Fall through to the original when the file cannot be decoded.
    }
  }

  if (query.download && !useThumbnail) {
    const filename = asset.originalFilename.replace(/["\\\r\n]+/g, '_')
    setHeader(event, 'content-disposition', `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  }

  if (!useThumbnail && !asset.mimeType.startsWith('image/')) {
    // Video and audio are streamed with byte-range support so players can seek.
    let path: string
    let size: number
    try {
      path = useThumbnail ? storage.path(key) : await assetFilePath(key)
      size = (await stat(path)).size
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Het opgeslagen mediabestand ontbreekt' })
    }
    setHeader(event, 'content-type', asset.mimeType)
    setHeader(event, 'accept-ranges', 'bytes')
    setHeader(event, 'cache-control', cacheControl)
    const rangeHeader = getRequestHeader(event, 'range')
    const range = parseRange(rangeHeader, size)
    if (rangeHeader && !range) {
      setHeader(event, 'content-range', `bytes */${size}`)
      throw createError({ statusCode: 416, statusMessage: 'Het gevraagde bereik is niet beschikbaar' })
    }
    if (range) {
      event.node.res.statusCode = 206
      setHeader(event, 'content-range', `bytes ${range.start}-${range.end}/${size}`)
      setHeader(event, 'content-length', range.end - range.start + 1)
      return sendStream(event, createReadStream(path, range))
    }
    setHeader(event, 'content-length', size)
    return sendStream(event, createReadStream(path))
  }

  try {
    const data = useThumbnail ? await storage.read(key) : await readAssetFile(key)
    setHeader(event, 'content-type', useThumbnail ? 'image/jpeg' : asset.mimeType)
    setHeader(event, 'cache-control', cacheControl)
    setHeader(event, 'content-length', data.length)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Het opgeslagen mediabestand ontbreekt' })
  }
})
