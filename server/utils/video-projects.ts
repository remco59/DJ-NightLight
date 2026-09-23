import { desc, eq, inArray } from 'drizzle-orm'
import { mediaAssets, videoProjects, videoRenderJobs } from '../../db/schema'
import { collectProjectAssetIds, parseVideoProject, type VideoProject } from '../../shared/video-project'
import { db } from './db'

export const VIDEO_EDITOR_ROLES = ['owner', 'content_editor'] as const

export function validateProject(value: unknown): VideoProject {
  try {
    return parseVideoProject(value)
  } catch (error) {
    const issue = (error as { issues?: Array<{ message: string, path: PropertyKey[] }> }).issues?.[0]
    throw createError({
      statusCode: 422,
      statusMessage: issue ? `Invalid video project: ${issue.message} (${issue.path.join('.')})` : 'Invalid video project',
    })
  }
}

/** Rejects projects that reference media assets which do not exist (anymore). */
export async function assertProjectAssetsExist(project: VideoProject) {
  const ids = collectProjectAssetIds(project)
  if (!ids.length) return
  const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(inArray(mediaAssets.id, ids))
  if (rows.length !== ids.length) {
    throw createError({ statusCode: 422, statusMessage: 'The project uses media that is no longer in the media library' })
  }
}

export async function getProjectOr404(id: string | undefined) {
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Video project id is required' })
  const [row] = await db.select().from(videoProjects).where(eq(videoProjects.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video project not found' })
  return row
}

export async function listProjectRenders(projectId: string) {
  const jobs = await db.select({
    id: videoRenderJobs.id,
    status: videoRenderJobs.status,
    progress: videoRenderJobs.progress,
    error: videoRenderJobs.error,
    renderEngine: videoRenderJobs.renderEngine,
    width: videoRenderJobs.width,
    height: videoRenderJobs.height,
    fps: videoRenderJobs.fps,
    durationSeconds: videoRenderJobs.durationSeconds,
    outputKey: videoRenderJobs.outputKey,
    createdAt: videoRenderJobs.createdAt,
    finishedAt: videoRenderJobs.finishedAt,
  }).from(videoRenderJobs)
    .where(eq(videoRenderJobs.projectId, projectId))
    .orderBy(desc(videoRenderJobs.createdAt))
    .limit(50)
  return jobs.map(({ outputKey, ...job }) => ({
    ...job,
    videoUrl: job.status === 'completed' && outputKey ? `/api/generated-videos/${job.id}` : null,
  }))
}
