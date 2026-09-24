import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { mediaAssets, mediaCollectionItems, mediaCollections } from '../../../../db/schema'
import { normalizeTags } from '../../../../shared/media'
import { db } from '../../../utils/db'
import { addAssetsToCollections, deleteMediaAssets } from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'

const ids = z.array(z.string().uuid()).min(1).max(500)
const tags = z.union([z.string(), z.array(z.string())])

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('addTags'), ids, tags }),
  z.object({ action: z.literal('removeTags'), ids, tags }),
  z.object({ action: z.literal('setGig'), ids, gigId: z.string().uuid().nullable() }),
  z.object({ action: z.literal('setVenue'), ids, venueId: z.string().uuid().nullable() }),
  z.object({ action: z.literal('addToCollection'), ids, collectionId: z.string().uuid() }),
  z.object({ action: z.literal('removeFromCollection'), ids, collectionId: z.string().uuid() }),
  z.object({ action: z.literal('moveToCollection'), ids, fromCollectionId: z.string().uuid(), collectionId: z.string().uuid() }),
  z.object({ action: z.literal('delete'), ids }),
])

async function requireCollection(id: string) {
  const [collection] = await db.select({ id: mediaCollections.id }).from(mediaCollections).where(eq(mediaCollections.id, id)).limit(1)
  if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const input = await readValidatedBody(event, schema.parse)
  const now = new Date()

  switch (input.action) {
    case 'addTags':
    case 'removeTags': {
      const change = normalizeTags(input.tags)
      if (!change.length) throw createError({ statusCode: 422, statusMessage: 'Enter at least one tag' })
      const rows = await db.select({ id: mediaAssets.id, tags: mediaAssets.tags }).from(mediaAssets).where(inArray(mediaAssets.id, input.ids))
      await db.transaction(async (tx) => {
        for (const row of rows) {
          const next = input.action === 'addTags'
            ? normalizeTags([...row.tags, ...change])
            : row.tags.filter(tag => !change.includes(tag))
          await tx.update(mediaAssets).set({ tags: next, updatedAt: now }).where(eq(mediaAssets.id, row.id))
        }
      })
      return { updated: rows.length }
    }
    case 'setGig': {
      const rows = await db.update(mediaAssets).set({ gigId: input.gigId, updatedAt: now }).where(inArray(mediaAssets.id, input.ids)).returning({ id: mediaAssets.id })
      return { updated: rows.length }
    }
    case 'setVenue': {
      const rows = await db.update(mediaAssets).set({ venueId: input.venueId, updatedAt: now }).where(inArray(mediaAssets.id, input.ids)).returning({ id: mediaAssets.id })
      return { updated: rows.length }
    }
    case 'addToCollection': {
      await requireCollection(input.collectionId)
      const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(inArray(mediaAssets.id, input.ids))
      await addAssetsToCollections(rows.map(row => row.id), [input.collectionId])
      return { updated: rows.length }
    }
    case 'removeFromCollection': {
      const rows = await db.delete(mediaCollectionItems)
        .where(and(eq(mediaCollectionItems.collectionId, input.collectionId), inArray(mediaCollectionItems.assetId, input.ids)))
        .returning({ id: mediaCollectionItems.assetId })
      return { updated: rows.length }
    }
    case 'moveToCollection': {
      await requireCollection(input.collectionId)
      const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(inArray(mediaAssets.id, input.ids))
      await addAssetsToCollections(rows.map(row => row.id), [input.collectionId])
      if (input.fromCollectionId !== input.collectionId) {
        await db.delete(mediaCollectionItems)
          .where(and(eq(mediaCollectionItems.collectionId, input.fromCollectionId), inArray(mediaCollectionItems.assetId, input.ids)))
      }
      return { updated: rows.length }
    }
    case 'delete':
      return await deleteMediaAssets(input.ids)
  }
})
