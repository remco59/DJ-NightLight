import { eq } from 'drizzle-orm'
import { socialPostMedia, videoRenderJobs } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { getGeneratedStorage } from '../../../../utils/media-storage'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])
  const id = requireUuidParam(event, 'id')

  const [job] = await db.select().from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Render niet gevonden' })
  if (job.status === 'rendering') {
    throw createError({ statusCode: 409, statusMessage: 'Een render die nog bezig is, kan pas worden verwijderd als hij klaar is' })
  }

  // Social posts keep pointing at their render (restrict), so removing it would break a queued or published post.
  const [used] = await db.select({ postId: socialPostMedia.postId }).from(socialPostMedia)
    .where(eq(socialPostMedia.videoRenderJobId, id)).limit(1)
  if (used) throw createError({ statusCode: 409, statusMessage: 'Deze video is gebruikt voor een social post en kan niet worden verwijderd' })

  await db.delete(videoRenderJobs).where(eq(videoRenderJobs.id, id))
  const storage = getGeneratedStorage()
  await Promise.all([
    storage.delete(job.outputKey),
    storage.delete(job.audioKey),
  ])

  return { ok: true }
})
