import { eq } from 'drizzle-orm'
import { generatedPosts, socialPostMedia } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { getGeneratedStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = requireUuidParam(event, 'id')

  const [post] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Gegenereerde post niet gevonden' })

  // Social posts keep pointing at their export (restrict), so removing it would break a queued or published post.
  const [used] = await db.select({ postId: socialPostMedia.postId }).from(socialPostMedia)
    .where(eq(socialPostMedia.generatedPostId, id)).limit(1)
  if (used) throw createError({ statusCode: 409, statusMessage: 'Deze export is gebruikt voor een Instagram-post en kan niet worden verwijderd' })

  await db.delete(generatedPosts).where(eq(generatedPosts.id, id))
  await getGeneratedStorage().delete(post.outputKey)
  return { ok: true }
})
