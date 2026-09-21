import { requireStaff } from '../../../utils/require-staff'
import { loadCalendarIntegration, loadEmailIntegration } from '../../../utils/integration-settings'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const [calendar, email] = await Promise.all([
    loadCalendarIntegration(),
    loadEmailIntegration(),
  ])
  return {
    calendar: calendar.status,
    email: email.status,
  }
})
