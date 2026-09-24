import { z } from 'zod'
import { isMediaSource, normalizeTags } from '../../../../shared/media'
import {
  MediaValidationError,
  isImageUpload,
  mediaAssetUrls,
  storeMediaImage,
  storeTimedMedia,
  validateParentAsset,
} from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'

const optionalUuid = z.string().uuid().or(z.literal('')).transform(value => value || null)
const uuidList = z.string().transform(value => value.split(',').map(item => item.trim()).filter(Boolean)).pipe(z.array(z.string().uuid()).max(50))
const sourceUrl = z.string().max(2000).url().refine(value => /^https?:\/\//i.test(value)).or(z.literal(''))

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Multipart upload is required' })

  const part = (name: string) => parts.find(item => item.name === name)
  const file = part('file')
  if (!file?.data?.length) throw createError({ statusCode: 422, statusMessage: 'Media file is required' })

  const text = (name: string) => part(name)?.data?.toString('utf8') || ''
  const gigId = optionalUuid.safeParse(text('gigId'))
  const venueId = optionalUuid.safeParse(text('venueId'))
  if (!gigId.success || !venueId.success) throw createError({ statusCode: 422, statusMessage: 'Invalid gig or venue association' })
  const parentAssetId = optionalUuid.safeParse(text('parentAssetId'))
  const collectionIds = uuidList.safeParse(text('collectionIds'))
  const origin = sourceUrl.safeParse(text('sourceUrl'))
  if (!parentAssetId.success || !collectionIds.success || !origin.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid original asset, collection or source URL' })
  }
  const requestedSource = text('source') || undefined
  if (requestedSource !== undefined && !isMediaSource(requestedSource)) throw createError({ statusCode: 422, statusMessage: 'Unknown media source' })

  try {
    const placement = {
      // Generated assets are only created by NightLight's own generators.
      source: requestedSource === 'generated' ? undefined : requestedSource,
      parentAssetId: await validateParentAsset(parentAssetId.data),
      variantLabel: text('variantLabel'),
      sourceUrl: origin.data || undefined,
      collectionIds: collectionIds.data,
    }
    if (!isImageUpload(file.data)) {
      let metadata: unknown = null
      try {
        metadata = JSON.parse(text('metadata') || 'null')
      } catch {
        throw new MediaValidationError('Media metadata is invalid JSON')
      }
      const asset = await storeTimedMedia({
        data: file.data,
        originalFilename: file.filename || 'media',
        metadata,
        thumbnail: part('thumbnail')?.data || null,
        title: text('title'),
        altText: text('altText'),
        tags: normalizeTags(text('tags')),
        gigId: gigId.data,
        venueId: venueId.data,
        ...placement,
      })
      event.node.res.statusCode = 201
      return { asset: { ...asset, ...mediaAssetUrls(asset) } }
    }

    const asset = await storeMediaImage({
      data: file.data,
      originalFilename: file.filename || 'image',
      thumbnail: part('thumbnail')?.data || null,
      title: text('title'),
      altText: text('altText'),
      tags: normalizeTags(text('tags')),
      gigId: gigId.data,
      venueId: venueId.data,
      ...placement,
    })
    event.node.res.statusCode = 201
    return { asset: { ...asset, ...mediaAssetUrls(asset) } }
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw createError({
        statusCode: 422,
        statusMessage: error.message,
      })
    }

    console.error('Media upload failed', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Upload failed because NightLight could not store the file.',
    })
  }
})
