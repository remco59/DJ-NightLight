import { eq } from 'drizzle-orm'
import { videoRenderJobs } from '../../../../../../db/schema'
import { db } from '../../../../../utils/db'
import { getGeneratedStorage } from '../../../../../utils/media-storage'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Video render job id is required' })

  const [job] = await db.select().from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Video render job not found' })
  if (job.status === 'rendering') {
    throw createError({ statusCode: 409, statusMessage: 'A rendering job cannot be deleted until it finishes' })
  }

  await db.delete(videoRenderJobs).where(eq(videoRenderJobs.id, id))
  const storage = getGeneratedStorage()
  await Promise.all([
    storage.delete(job.outputKey),
    storage.delete(job.audioKey),
  ])

  return { ok: true }
})
