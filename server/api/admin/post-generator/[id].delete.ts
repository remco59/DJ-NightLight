import { eq } from 'drizzle-orm'
import { generatedPosts } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { getGeneratedStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = requireUuidParam(event, 'id')

  const [post] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Gegenereerde post niet gevonden' })

  await db.delete(generatedPosts).where(eq(generatedPosts.id, id))
  await getGeneratedStorage().delete(post.outputKey)
  return { ok: true }
})
