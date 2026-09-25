import { z } from 'zod'
import { isMediaSource, normalizeTags } from '../../../../../../shared/media'
import {
  MediaValidationError,
  mediaAssetUrls,
  storeTimedMedia,
  validateParentAsset,
} from '../../../../../utils/media-library'
import {
  assembleMediaUpload,
  readMediaUploadSession,
  removeMediaUploadSession,
} from '../../../../../utils/media-upload-sessions'
import { requireStaff } from '../../../../../utils/require-staff'

const optionalUuid = z.string().uuid().or(z.literal('')).transform(value => value || null)
const sourceUrl = z.string().max(2000).url().refine(value => /^https?:\/\//i.test(value)).or(z.literal(''))
const completeSchema = z.object({
  title: z.string().max(240).default(''),
  altText: z.string().max(500).default(''),
  tags: z.string().default(''),
  gigId: z.string().default(''),
  venueId: z.string().default(''),
  parentAssetId: z.string().default(''),
  variantLabel: z.string().max(80).default(''),
  collectionIds: z.array(z.string().uuid()).max(50).default([]),
  source: z.string().default(''),
  sourceUrl: z.string().default(''),
  metadata: z.unknown(),
  thumbnailBase64: z.string().max(4_000_000).nullable().default(null),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const uploadId = getRouterParam(event, 'id') || ''
  const session = await readMediaUploadSession(uploadId)
  const parsed = completeSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige metadata voor upload' })

  const gigId = optionalUuid.safeParse(parsed.data.gigId)
  const venueId = optionalUuid.safeParse(parsed.data.venueId)
  const parentAssetId = optionalUuid.safeParse(parsed.data.parentAssetId)
  const origin = sourceUrl.safeParse(parsed.data.sourceUrl)
  if (!gigId.success || !venueId.success || !parentAssetId.success || !origin.success) {
    throw createError({ statusCode: 422, statusMessage: 'Ongeldige koppeling, origineel of bron-URL' })
  }
  const requestedSource = parsed.data.source || undefined
  if (requestedSource !== undefined && !isMediaSource(requestedSource)) {
    throw createError({ statusCode: 422, statusMessage: 'Onbekende mediabron' })
  }

  try {
    const data = await assembleMediaUpload(session)
    const thumbnail = parsed.data.thumbnailBase64 ? Buffer.from(parsed.data.thumbnailBase64, 'base64') : null
    const asset = await storeTimedMedia({
      data,
      originalFilename: session.filename,
      metadata: parsed.data.metadata,
      thumbnail,
      title: parsed.data.title,
      altText: parsed.data.altText,
      tags: normalizeTags(parsed.data.tags),
      gigId: gigId.data,
      venueId: venueId.data,
      source: requestedSource === 'generated' ? undefined : requestedSource,
      parentAssetId: await validateParentAsset(parentAssetId.data),
      variantLabel: parsed.data.variantLabel,
      sourceUrl: origin.data || undefined,
      collectionIds: parsed.data.collectionIds,
    })
    await removeMediaUploadSession(uploadId)
    event.node.res.statusCode = 201
    return { asset: { ...asset, ...mediaAssetUrls(asset) } }
  } catch (error) {
    if (error instanceof MediaValidationError) {
      await removeMediaUploadSession(uploadId).catch(() => undefined)
      throw createError({ statusCode: 422, statusMessage: error.message })
    }
    throw error
  }
})
