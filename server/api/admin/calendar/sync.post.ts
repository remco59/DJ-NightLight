import { z } from 'zod'
import { queueCalendarSync, syncAllCalendarGigs, syncGigToCalendar } from '../../../utils/calendar-sync'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  gigId: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, schema.parse)

  if (input.gigId) {
    await queueCalendarSync(input.gigId)
    try {
      const result = await syncGigToCalendar(input.gigId)
      return { result }
    } catch (error) {
      throw createError({
        statusCode: 502,
        statusMessage: error instanceof Error ? error.message : 'Agendasynchronisatie mislukt',
      })
    }
  }

  const result = await syncAllCalendarGigs()
  return { result }
})
