import { eq } from 'drizzle-orm'
import { generatedPosts } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { getGeneratedStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID van de gegenereerde post is verplicht' })

  const [post] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Gegenereerde post niet gevonden' })

  await db.delete(generatedPosts).where(eq(generatedPosts.id, id))
  await getGeneratedStorage().delete(post.outputKey)
  return { ok: true }
})
