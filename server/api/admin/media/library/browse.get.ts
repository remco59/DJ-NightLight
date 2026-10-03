import { z } from 'zod'
import { listLibraryDirectory } from '../../../../utils/media-library-link'
import { requireStaff } from '../../../../utils/require-staff'

const querySchema = z.object({
  path: z.string().max(1000).optional(),
  kind: z.enum(['image', 'all']).default('all'),
})

/** Lists one folder of the server media folder; `{ enabled: false }` when it is not configured. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige zoekopdracht' })
  try {
    return await listLibraryDirectory(parsed.data.path, parsed.data.kind)
  } catch (error) {
    if (error instanceof Error && error.name === 'MediaValidationError') {
      throw createError({ statusCode: 422, statusMessage: error.message })
    }
    throw error
  }
})
