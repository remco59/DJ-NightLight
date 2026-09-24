import { deleteMediaAssets, getMediaUsage } from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media id is required' })

  const usage = await getMediaUsage(id)
  if (!usage) throw createError({ statusCode: 404, statusMessage: 'Media asset not found' })
  if (usage.references.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Media asset is still in use',
      data: { references: usage.references },
    })
  }

  const result = await deleteMediaAssets([id])
  if (result.blocked.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Media asset is still in use',
      data: { references: result.blocked[0]!.references },
    })
  }
  return { ok: true }
})
