import { eq } from 'drizzle-orm'
import { videoRenderJobs } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { getGeneratedStorage } from '../../../../utils/media-storage'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Render-ID is verplicht' })

  const [job] = await db.select().from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Render niet gevonden' })
  if (job.status === 'rendering') {
    throw createError({ statusCode: 409, statusMessage: 'Een render die nog bezig is, kan pas worden verwijderd als hij klaar is' })
  }

  await db.delete(videoRenderJobs).where(eq(videoRenderJobs.id, id))
  const storage = getGeneratedStorage()
  await Promise.all([
    storage.delete(job.outputKey),
    storage.delete(job.audioKey),
  ])

  return { ok: true }
})
