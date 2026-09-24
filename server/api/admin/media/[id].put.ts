import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { mediaAssets } from '../../../../db/schema'
import { normalizeTags } from '../../../../shared/media'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  title: z.string().max(240).default(''),
  altText: z.string().max(500).default(''),
  tags: z.union([z.string(), z.array(z.string())]).default([]),
  gigId: z.string().uuid().nullable().optional(),
  venueId: z.string().uuid().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Media-ID is verplicht' })
  const input = await readValidatedBody(event, schema.parse)

  const [asset] = await db.update(mediaAssets).set({
    title: input.title,
    altText: input.altText,
    tags: normalizeTags(input.tags),
    gigId: input.gigId ?? null,
    venueId: input.venueId ?? null,
    updatedAt: new Date(),
  }).where(eq(mediaAssets.id, id)).returning()

  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Mediabestand niet gevonden' })
  return { asset }
})
