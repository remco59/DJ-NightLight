import { z } from 'zod'
import { normalizeTags } from '../../../../shared/media'
import { MediaValidationError, isImageUpload, storeMediaImage, storeTimedMedia } from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'

const optionalUuid = z.string().uuid().or(z.literal('')).transform(value => value || null)

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

  try {
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
        tags: normalizeTags(text('tags')),
        gigId: gigId.data,
        venueId: venueId.data,
      })
      event.node.res.statusCode = 201
      return {
        asset: {
          ...asset,
          url: `/api/media/${asset.id}`,
          thumbnailUrl: asset.thumbnailKey ? `/api/media/${asset.id}?variant=thumb` : null,
        },
      }
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
    })
    event.node.res.statusCode = 201
    return {
      asset: {
        ...asset,
        url: `/api/media/${asset.id}`,
        thumbnailUrl: `/api/media/${asset.id}?variant=thumb`,
      },
    }
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
