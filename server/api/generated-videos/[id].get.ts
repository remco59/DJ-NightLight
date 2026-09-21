import { eq } from 'drizzle-orm'
import { videoRenderJobs } from '../../../db/schema'
import { db } from '../../utils/db'
import { getGeneratedStorage } from '../../utils/media-storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Generated video id is required' })

  const [job] = await db.select({
    outputKey: videoRenderJobs.outputKey,
    outputMimeType: videoRenderJobs.outputMimeType,
    status: videoRenderJobs.status,
  }).from(videoRenderJobs).where(eq(videoRenderJobs.id, id)).limit(1)

  if (!job || job.status !== 'completed' || !job.outputKey) {
    throw createError({ statusCode: 404, statusMessage: 'Generated video not found' })
  }

  try {
    const data = await getGeneratedStorage().read(job.outputKey)
    setHeader(event, 'content-type', job.outputMimeType)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    setHeader(event, 'content-disposition', `inline; filename="nightlight-${id}.mp4"`)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Generated video file is missing' })
  }
})
