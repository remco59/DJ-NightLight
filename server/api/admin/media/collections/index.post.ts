import { max } from 'drizzle-orm'
import { z } from 'zod'
import { mediaCollections } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { addAssetsToCollections, collectionConflict } from '../../../../utils/media-library'
import { requireStaff } from '../../../../utils/require-staff'

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default(''),
  assetIds: z.array(z.string().uuid()).max(500).default([]),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const input = await readValidatedBody(event, schema.parse)
  const [last] = await db.select({ value: max(mediaCollections.sortOrder) }).from(mediaCollections)
  try {
    const [collection] = await db.insert(mediaCollections).values({
      name: input.name,
      description: input.description,
      sortOrder: (last?.value ?? -1) + 1,
    }).returning()
    if (!collection) throw new Error('Collection could not be created')
    await addAssetsToCollections(input.assetIds, [collection.id])
    event.node.res.statusCode = 201
    return { collection }
  } catch (error) {
    throw collectionConflict(error)
  }
})
