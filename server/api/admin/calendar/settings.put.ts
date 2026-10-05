import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { calendarSyncSettings } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  enabled: z.boolean(),
  calendarId: z.string().trim().min(1).max(255),
  cancellationBehavior: z.enum(['delete', 'mark_cancelled', 'keep']),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, schema.parse)
  const [settings] = await db
    .update(calendarSyncSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(calendarSyncSettings.key, 'default'))
    .returning()

  if (!settings) throw createError({ statusCode: 404, statusMessage: 'Agenda-instellingen niet gevonden' })
  return { settings }
})
