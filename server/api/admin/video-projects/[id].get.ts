import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, getProjectOr404, listProjectRenders } from '../../../utils/video-projects'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const project = await getProjectOr404(requireUuidParam(event, 'id'))
  return { project, renders: await listProjectRenders(project.id) }
})
