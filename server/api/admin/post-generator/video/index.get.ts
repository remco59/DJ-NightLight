import { desc, eq } from 'drizzle-orm'
import { mediaAssets, videoRenderJobs } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'content_editor'])

  const jobs = await db
    .select({
      id: videoRenderJobs.id,
      sourceMediaAssetId: videoRenderJobs.sourceMediaAssetId,
      templateKey: videoRenderJobs.templateKey,
      motionPreset: videoRenderJobs.motionPreset,
      brandPreset: videoRenderJobs.brandPreset,
      design: videoRenderJobs.design,
      width: videoRenderJobs.width,
      height: videoRenderJobs.height,
      fps: videoRenderJobs.fps,
      durationSeconds: videoRenderJobs.durationSeconds,
      status: videoRenderJobs.status,
      progress: videoRenderJobs.progress,
      error: videoRenderJobs.error,
      outputKey: videoRenderJobs.outputKey,
      createdAt: videoRenderJobs.createdAt,
      updatedAt: videoRenderJobs.updatedAt,
      startedAt: videoRenderJobs.startedAt,
      finishedAt: videoRenderJobs.finishedAt,
      sourceTitle: mediaAssets.title,
      sourceFilename: mediaAssets.originalFilename,
    })
    .from(videoRenderJobs)
    .leftJoin(mediaAssets, eq(videoRenderJobs.sourceMediaAssetId, mediaAssets.id))
    .orderBy(desc(videoRenderJobs.createdAt))
    .limit(100)

  return {
    jobs: jobs.map(job => ({
      ...job,
      videoUrl: job.status === 'completed' && job.outputKey ? `/api/generated-videos/${job.id}` : null,
    })),
  }
})
