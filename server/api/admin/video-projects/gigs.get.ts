import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, listTemplateGigs } from '../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, VIDEO_EDITOR_ROLES)
  const past = getQuery(event).past === '1'
  return { gigs: await listTemplateGigs(user.role, past ? 100 : 50, past) }
})
