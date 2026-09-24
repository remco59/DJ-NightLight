import { eq } from 'drizzle-orm'
import { videoRenderJobs } from '../../../../../../db/schema'
import { canRetryRender } from '../../../../../../shared/video-generator'
import { db } from '../../../../../utils/db'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Video render job id is required' })

  const [job] = await db.select().from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Video render job not found' })
  if (!canRetryRender(job.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Only failed or cancelled renders can be retried' })
  }

  const [updated] = await db.update(videoRenderJobs).set({
    status: 'queued',
    progress: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date(),
  }).where(eq(videoRenderJobs.id, id)).returning()

  return { job: updated }
})
