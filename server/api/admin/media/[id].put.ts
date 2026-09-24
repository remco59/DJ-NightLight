import { and, eq, notInArray } from 'drizzle-orm'
import { z } from 'zod'
import { mediaAssets, mediaCollectionItems } from '../../../../db/schema'
import { normalizeTags } from '../../../../shared/media'
import { db } from '../../../utils/db'
import { MediaValidationError, addAssetsToCollections, mediaAssetUrls, validateParentAsset } from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'

// Every field is optional so the inspector, pickers and bulk tools can change
// just what they edit; omitted fields keep their stored value.
const schema = z.object({
  title: z.string().max(240).optional(),
  altText: z.string().max(500).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  gigId: z.string().uuid().nullable().optional(),
  venueId: z.string().uuid().nullable().optional(),
  parentAssetId: z.string().uuid().nullable().optional(),
  variantLabel: z.string().max(80).optional(),
  collectionIds: z.array(z.string().uuid()).max(50).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media id is required' })
  const input = await readValidatedBody(event, schema.parse)

  let parentAssetId: string | null | undefined
  try {
    parentAssetId = input.parentAssetId === undefined ? undefined : await validateParentAsset(input.parentAssetId, id)
  } catch (error) {
    if (error instanceof MediaValidationError) throw createError({ statusCode: 422, statusMessage: error.message })
    throw error
  }

  const [asset] = await db.update(mediaAssets).set({
    ...(input.title !== undefined && { title: input.title }),
    ...(input.altText !== undefined && { altText: input.altText }),
    ...(input.tags !== undefined && { tags: normalizeTags(input.tags) }),
    ...(input.gigId !== undefined && { gigId: input.gigId }),
    ...(input.venueId !== undefined && { venueId: input.venueId }),
    ...(parentAssetId !== undefined && { parentAssetId }),
    ...(input.variantLabel !== undefined && { variantLabel: input.variantLabel.trim() }),
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, id)).returning()

  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Media asset not found' })

  if (input.collectionIds) {
    await db.delete(mediaCollectionItems).where(and(
      eq(mediaCollectionItems.assetId, id),
      input.collectionIds.length ? notInArray(mediaCollectionItems.collectionId, input.collectionIds) : undefined,
    ))
    await addAssetsToCollections([id], input.collectionIds)
  }
  return { asset: { ...asset, ...mediaAssetUrls(asset) } }
})
