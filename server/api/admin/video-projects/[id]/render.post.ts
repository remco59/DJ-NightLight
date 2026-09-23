import { videoRenderJobs } from '../../../../../db/schema'
import { projectDurationFrames } from '../../../../../shared/video-project'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, assertProjectAssetsExist, getProjectOr404, validateProject } from '../../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, VIDEO_EDITOR_ROLES)
  const row = await getProjectOr404(getRouterParam(event, 'id'))
  // Renders always use the saved project; the job keeps its own snapshot so
  // later edits never change an export that is queued or finished.
  const project = validateProject(row.project)
  await assertProjectAssetsExist(project)
  const hasContent = project.tracks.some(track => track.items.length)
  if (!hasContent) throw createError({ statusCode: 422, statusMessage: 'Add something to the timeline before exporting' })

  const [job] = await db.insert(videoRenderJobs).values({
    projectId: row.id,
    projectSnapshot: project,
    createdByUserId: user.id,
    templateKey: 'project',
    motionPreset: 'project',
    brandPreset: 'project',
    design: {},
    width: project.width,
    height: project.height,
    fps: project.fps,
    durationSeconds: Math.ceil(projectDurationFrames(project) / project.fps),
    status: 'queued',
    progress: 0,
  }).returning()
  if (!job) throw createError({ statusCode: 500, statusMessage: 'Render could not be queued' })
  event.node.res.statusCode = 202
  return { job: { id: job.id, status: job.status, progress: job.progress } }
})
