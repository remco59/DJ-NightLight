import { requireStaff } from '../../../utils/require-staff'
import { loadCalendarIntegration, loadEmailIntegration, loadInstagramIntegration } from '../../../utils/integration-settings'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const [calendar, email, instagram] = await Promise.all([
    loadCalendarIntegration(),
    loadEmailIntegration(),
    loadInstagramIntegration(),
  ])
  return {
    calendar: calendar.status,
    email: email.status,
    instagram: instagram.status,
  }
})
