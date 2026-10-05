import { calendarFeedUrl, rotateIcsToken } from '../../../utils/calendar-subscription'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const token = await rotateIcsToken()
  return { icsUrl: calendarFeedUrl(token) }
})
