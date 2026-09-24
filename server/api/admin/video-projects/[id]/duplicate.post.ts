import { videoProjects } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, getProjectOr404 } from '../../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, VIDEO_EDITOR_ROLES)
  const source = await getProjectOr404(getRouterParam(event, 'id'))
  const [row] = await db.insert(videoProjects).values({
    name: `${source.name} (copy)`.slice(0, 160),
    project: source.project,
    createdByUserId: user.id,
  }).returning()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Videoproject dupliceren is niet gelukt' })
  event.node.res.statusCode = 201
  return { project: row }
})
