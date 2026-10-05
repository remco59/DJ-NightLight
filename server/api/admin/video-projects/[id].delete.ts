import { eq } from 'drizzle-orm'
import { videoProjects } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, getProjectOr404 } from '../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const project = await getProjectOr404(getRouterParam(event, 'id'))
  // Render jobs keep their snapshot and output; their project link is set to null.
  await db.delete(videoProjects).where(eq(videoProjects.id, project.id))
  return { ok: true }
})
