import { eq } from 'drizzle-orm'
import { videoRenderJobs } from '../../../db/schema'
import { db } from '../../utils/db'
import { getGeneratedStorage } from '../../utils/media-storage'
import { requireUuidParam } from '../../utils/route-params'

export default defineEventHandler(async (event) => {
  const id = requireUuidParam(event, 'id')

  const [job] = await db.select({
    outputKey: videoRenderJobs.outputKey,
    outputMimeType: videoRenderJobs.outputMimeType,
    status: videoRenderJobs.status,
  }).from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)

  if (!job || job.status !== 'completed' || !job.outputKey) {
    throw createError({ statusCode: 404, statusMessage: 'Gegenereerde video niet gevonden' })
  }

  try {
    const data = await getGeneratedStorage().read(job.outputKey)
    setHeader(event, 'content-type', job.outputMimeType)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    setHeader(event, 'content-disposition', `inline; filename="nightlight-${id}.mp4"`)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Bestand van de gegenereerde video ontbreekt' })
  }
})
