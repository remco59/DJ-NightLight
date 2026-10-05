import { desc, eq } from 'drizzle-orm'
import { gigCalendarSync, gigs } from '../../../../db/schema'
import { calendarFeedUrl, ensureIcsToken } from '../../../utils/calendar-subscription'
import { getCalendarSyncSettings } from '../../../utils/calendar-sync'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { loadCalendarIntegration } from '../../../utils/integration-settings'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const settings = await getCalendarSyncSettings()
  const integration = await loadCalendarIntegration()
  const icsToken = await ensureIcsToken()

  const items = await db
    .select({
      gigId: gigs.id,
      title: gigTitleSql(),
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
    settings: {
      enabled: settings.enabled,
      calendarId: settings.calendarId,
      cancellationBehavior: settings.cancellationBehavior,
    },
    credentialsConfigured: integration.status.configured,
    icsUrl: calendarFeedUrl(icsToken),
    items,
  }
})
