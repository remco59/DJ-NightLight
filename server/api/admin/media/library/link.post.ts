import { z } from 'zod'
import { LIBRARY_MAX_LINK_BATCH } from '../../../../../shared/media-library-browse'
import { normalizeTags } from '../../../../../shared/media'
import { MediaValidationError, mediaAssetUrls, validateParentAsset } from '../../../../utils/media-library'
import { linkLibraryFile } from '../../../../utils/media-library-link'
import { requireStaff } from '../../../../utils/require-staff'

const optionalUuid = z.string().uuid().or(z.literal('')).transform(value => value || null)
const bodySchema = z.object({
  items: z.array(z.object({ path: z.string().min(1).max(1000), title: z.string().max(240).default('') })).min(1).max(LIBRARY_MAX_LINK_BATCH),
  altText: z.string().max(500).default(''),
  tags: z.string().default(''),
  gigId: optionalUuid.default(''),
  venueId: optionalUuid.default(''),
  parentAssetId: optionalUuid.default(''),
  variantLabel: z.string().max(80).default(''),
  collectionIds: z.array(z.string().uuid()).max(50).default([]),
})

/** Links files from the server media folder into the library without copying them. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige gegevens voor koppelen' })
  const body = parsed.data

  let parentAssetId: string | null
  try {
    parentAssetId = await validateParentAsset(body.parentAssetId)
  } catch (error) {
    if (error instanceof MediaValidationError) throw createError({ statusCode: 422, statusMessage: error.message })
    throw error
  }

  const assets: Array<{ path: string, alreadyLinked: boolean, asset: Record<string, unknown> }> = []
  const failed: Array<{ path: string, error: string }> = []
  // Sequential: each link runs ffprobe/ffmpeg, which is heavy enough to not run in parallel.
  for (const item of body.items) {
    try {
      const result = await linkLibraryFile({
        path: item.path,
        title: item.title,
        altText: body.altText,
        tags: normalizeTags(body.tags),
        gigId: body.gigId,
        venueId: body.venueId,
        parentAssetId,
        variantLabel: body.variantLabel,
        collectionIds: body.collectionIds,
      })
      assets.push({ path: item.path, alreadyLinked: result.alreadyLinked, asset: { ...result.asset, ...mediaAssetUrls(result.asset) } })
    } catch (error) {
      if (!(error instanceof MediaValidationError)) console.error('Library link failed', item.path, error)
      failed.push({
        path: item.path,
        error: error instanceof MediaValidationError ? error.message : 'Koppelen mislukt door een serverfout.',
      })
    }
  }
  event.node.res.statusCode = assets.length ? 201 : 200
  return { assets, failed }
})
