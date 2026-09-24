import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { calendarSyncSettings, emailProviderSettings } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { clearGoogleCalendarTokenCache } from '../../../utils/google-calendar'
import { loadCalendarIntegration, loadEmailIntegration } from '../../../utils/integration-settings'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({ provider: z.enum(['calendar', 'email']) })

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige integratie' })

  if (parsed.data.provider === 'calendar') {
    await db.update(calendarSyncSettings).set({
      clientId: null,
      clientSecretEncrypted: null,
      refreshTokenEncrypted: null,
      updatedAt: new Date(),
    }).where(eq(calendarSyncSettings.key, 'default'))
    clearGoogleCalendarTokenCache()
    return { calendar: (await loadCalendarIntegration()).status }
  }

  await db.delete(emailProviderSettings).where(eq(emailProviderSettings.key, 'default'))
  return { email: (await loadEmailIntegration()).status }
})
