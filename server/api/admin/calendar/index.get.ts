import { desc, eq } from 'drizzle-orm'
import { gigCalendarSync, gigs } from '../../../../db/schema'
import { getCalendarSyncSettings } from '../../../utils/calendar-sync'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const settings = await getCalendarSyncSettings()
  const config = useRuntimeConfig()
  const credentials = config.googleCalendar as { clientId?: string, clientSecret?: string, refreshToken?: string }

  const items = await db
    .select({
      gigId: gigs.id,
      title: gigs.title,
      gigStatus: gigs.status,
      startsAt: gigs.startsAt,
      syncStatus: gigCalendarSync.status,
      providerEventId: gigCalendarSync.providerEventId,
      retryCount: gigCalendarSync.retryCount,
      nextRetryAt: gigCalendarSync.nextRetryAt,
      lastAttemptAt: gigCalendarSync.lastAttemptAt,
      lastSyncedAt: gigCalendarSync.lastSyncedAt,
      lastError: gigCalendarSync.lastError,
    })
    .from(gigCalendarSync)
    .innerJoin(gigs, eq(gigCalendarSync.gigId, gigs.id))
    .orderBy(desc(gigs.startsAt), desc(gigCalendarSync.updatedAt))
    .limit(100)

  return {
    settings,
    credentialsConfigured: Boolean(credentials.clientId && credentials.clientSecret && credentials.refreshToken),
    items,
  }
})
