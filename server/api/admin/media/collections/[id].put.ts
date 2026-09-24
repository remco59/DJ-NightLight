import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { mediaCollections } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { collectionConflict } from '../../../../utils/media-library'
import { requireStaff } from '../../../../utils/require-staff'

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Collection id is required' })
  const input = await readValidatedBody(event, schema.parse)
  try {
    const [collection] = await db.update(mediaCollections)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(mediaCollections.id, id))
      .returning()
    if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
    return { collection }
  } catch (error) {
    throw collectionConflict(error)
  }
})
