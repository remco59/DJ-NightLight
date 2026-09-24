import { and, eq, inArray } from 'drizzle-orm'
import { videoRenderJobs } from '../../../../../../db/schema'
import { CANCELLABLE_RENDER_STATUSES } from '../../../../../../shared/video-generator'
import { db } from '../../../../../utils/db'
import { requireStaff } from '../../../../../utils/require-staff'

// Works for project exports and legacy single-image videos alike. A job that
// is rendering is stopped by the worker, which watches for this status change;
// if no worker is running, the job is simply taken out of the queue.
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Video render job id is required' })

  const [job] = await db.select({ id: videoRenderJobs.id }).from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Video render job not found' })

  // The status check is part of the update so a job that completes at the same
  // moment keeps its video.
  const [updated] = await db.update(videoRenderJobs).set({
    status: 'cancelled',
    finishedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(videoRenderJobs.id, id),
    inArray(videoRenderJobs.status, [...CANCELLABLE_RENDER_STATUSES]),
  )).returning()
  if (!updated) throw createError({ statusCode: 409, statusMessage: 'Only queued, rendering or failed renders can be cancelled' })

  return { job: updated }
})
