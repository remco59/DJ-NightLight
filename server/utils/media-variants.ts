import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { RESPONSIVE_IMAGE_WIDTHS } from '../../shared/responsive-image'
import { getGeneratedStorage, getMediaStorage } from './media-storage'

const RESIZABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isResponsiveWidth(value: unknown): value is (typeof RESPONSIVE_IMAGE_WIDTHS)[number] {
  return RESPONSIVE_IMAGE_WIDTHS.includes(Number(value) as (typeof RESPONSIVE_IMAGE_WIDTHS)[number])
}

export function canResizeImage(mimeType: string) {
  return RESIZABLE_MIME_TYPES.has(mimeType)
}

function variantKey(assetId: string, width: number) {
  return `image-variants/${assetId}/${width}.webp`
}

const inFlight = new Map<string, Promise<Buffer>>()

/**
 * Web-sized WebP rendition of an uploaded image. Originals are camera files of
 * several megabytes; public pages request one of the fixed widths instead and
 * the result is cached in generated storage after the first request.
 */
export async function getImageVariant(asset: { id: string, storageKey: string }, width: number) {
  const generated = getGeneratedStorage()
  const key = variantKey(asset.id, width)
  try {
    return await readFile(generated.path(key))
  } catch {
    // Not rendered yet.
  }

  const pending = inFlight.get(key)
  if (pending) return pending

  const render = (async () => {
    const original = await getMediaStorage().read(asset.storageKey)
    const output = await sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
    await generated.putAt(key, output)
    return output
  })()
  inFlight.set(key, render)
  try {
    return await render
  } finally {
    inFlight.delete(key)
  }
}

export async function deleteImageVariants(assetId: string) {
  await getGeneratedStorage().deleteDirectory(`image-variants/${assetId}`)
}
