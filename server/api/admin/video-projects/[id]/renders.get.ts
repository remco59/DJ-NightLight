import { requireStaff } from '../../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, getProjectOr404, listProjectRenders } from '../../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const project = await getProjectOr404(getRouterParam(event, 'id'))
  return { renders: await listProjectRenders(project.id) }
})
