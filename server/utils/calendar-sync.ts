import { and, eq, inArray, isNull, lte } from 'drizzle-orm'
import { calendarSyncSettings, gigCalendarSync, gigs, venues } from '../../db/schema'
import {
  calendarRetryDelayMs,
  cancellationSummary,
  googleEventIdForGig,
  shouldHaveCalendarEvent,
} from '../../shared/calendar'
import { db } from './db'
import { googleCalendarFetch } from './google-calendar'
import { gigTitleSql } from './gig-title'

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1500) : String(error).slice(0, 1500)
}

async function googleError(response: Response) {
  const body = (await response.text()).slice(0, 800)
  return new Error(`Verzoek aan Google Calendar mislukt (${response.status}): ${body || response.statusText}`)
}

export async function getCalendarSyncSettings() {
  let [settings] = await db.select().from(calendarSyncSettings).where(eq(calendarSyncSettings.key, 'default')).limit(1)
  if (!settings) {
    [settings] = await db.insert(calendarSyncSettings).values({ key: 'default' }).returning()
  }
  if (!settings) throw new Error('Instellingen voor agendasynchronisatie konden niet worden geladen')
  return settings
}

export async function queueCalendarSync(gigId: string) {
  const now = new Date()
  await db.insert(gigCalendarSync).values({
    gigId,
    status: 'pending',
    nextRetryAt: now,
  }).onConflictDoUpdate({
    target: gigCalendarSync.gigId,
    set: {
      status: 'pending',
      nextRetryAt: now,
      lastError: null,
      updatedAt: now,
    },
  })
}

async function loadGig(gigId: string) {
  const [row] = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      loadInAt: gigs.loadInAt,
      internalNotes: gigs.internalNotes,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(eq(gigs.id, gigId), isNull(gigs.deletedAt)))
    .limit(1)
  return row
}

function eventPayload(gig: NonNullable<Awaited<ReturnType<typeof loadGig>>>, cancelled = false) {
  if (!gig.startsAt) throw new Error('De geboekte gig heeft geen starttijd')
  const start = new Date(gig.startsAt)
  const end = gig.endsAt ? new Date(gig.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const venue = [gig.venueName, gig.venueAddress, gig.venueCity].filter(Boolean).join(', ')
  const description = [
    gig.eventType ? `Type: ${gig.eventType}` : null,
    gig.loadInAt ? `Load-in: ${new Date(gig.loadInAt).toISOString()}` : null,
    gig.internalNotes || null,
    'Synced one-way from DJ NightLight.',
  ].filter(Boolean).join('\n\n')

  return {
    summary: cancelled ? cancellationSummary(gig.title) : gig.title,
    description,
    location: venue || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        nightlightGigId: gig.id,
        nightlightSource: 'dj-nightlight',
      },
    },
  }
}

async function upsertGoogleEvent(calendarId: string, eventId: string, payload: Record<string, unknown>) {
  const base = `calendars/${encodeURIComponent(calendarId)}/events`
  const existing = await googleCalendarFetch(`${base}/${eventId}`)
  if (existing.ok) {
    const updated = await googleCalendarFetch(`${base}/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!updated.ok) throw await googleError(updated)
    return
  }
  if (existing.status !== 404 && existing.status !== 410) throw await googleError(existing)

  const inserted = await googleCalendarFetch(base, {
    method: 'POST',
    body: JSON.stringify({ id: eventId, ...payload }),
  })
  if (inserted.status === 409) {
    const updated = await googleCalendarFetch(`${base}/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!updated.ok) throw await googleError(updated)
    return
  }
  if (!inserted.ok) throw await googleError(inserted)
}

async function deleteGoogleEvent(calendarId: string, eventId: string) {
  const response = await googleCalendarFetch(
    `calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'DELETE' },
  )
  if (!response.ok && response.status !== 404 && response.status !== 410) throw await googleError(response)
}

async function updateCancelledEvent(calendarId: string, eventId: string, payload: Record<string, unknown>) {
  const response = await googleCalendarFetch(
    `calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
  if (response.status === 404 || response.status === 410) return false
  if (!response.ok) throw await googleError(response)
  return true
}

export async function syncGigToCalendar(gigId: string) {
  const settings = await getCalendarSyncSettings()
  const now = new Date()
  let [state] = await db.select().from(gigCalendarSync).where(eq(gigCalendarSync.gigId, gigId)).limit(1)
  if (!state) {
    [state] = await db.insert(gigCalendarSync).values({ gigId, nextRetryAt: now }).returning()
  }
  if (!state) return { status: 'missing' as const }

  if (!settings.enabled) {
    await db.update(gigCalendarSync).set({
      status: 'skipped',
      lastError: 'Calendar synchronization is disabled',
      updatedAt: now,
    }).where(eq(gigCalendarSync.gigId, gigId))
    return { status: 'disabled' as const }
  }

  const gig = await loadGig(gigId)
  if (!gig) {
    await db.update(gigCalendarSync).set({
      status: 'skipped',
      lastError: 'Gig no longer exists',
      updatedAt: now,
    }).where(eq(gigCalendarSync.gigId, gigId))
    return { status: 'missing' as const }
  }

  const eventId = state.providerEventId || googleEventIdForGig(gigId)
  await db.update(gigCalendarSync).set({
    status: 'syncing',
    lastAttemptAt: now,
    updatedAt: now,
  }).where(eq(gigCalendarSync.gigId, gigId))

  try {
    if (shouldHaveCalendarEvent(gig.status, gig.startsAt)) {
      await upsertGoogleEvent(settings.calendarId, eventId, eventPayload(gig))
    } else if (!state.providerEventId) {
      await db.update(gigCalendarSync).set({
        status: 'skipped',
        lastError: null,
        retryCount: 0,
        updatedAt: new Date(),
      }).where(eq(gigCalendarSync.gigId, gigId))
      return { status: 'skipped' as const }
    } else if (settings.cancellationBehavior === 'delete') {
      await deleteGoogleEvent(settings.calendarId, eventId)
    } else if (settings.cancellationBehavior === 'mark_cancelled') {
      const updated = await updateCancelledEvent(settings.calendarId, eventId, eventPayload(gig, true))
      if (!updated) {
        await db.update(gigCalendarSync).set({
          status: 'skipped',
          lastError: 'Mapped Google event no longer exists',
          updatedAt: new Date(),
        }).where(eq(gigCalendarSync.gigId, gigId))
        return { status: 'skipped' as const }
      }
    } else {
      await db.update(gigCalendarSync).set({
        status: 'skipped',
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(gigCalendarSync.gigId, gigId))
      return { status: 'kept' as const }
    }

    const completedAt = new Date()
    await db.update(gigCalendarSync).set({
      providerEventId: eventId,
      status: 'synced',
      retryCount: 0,
      nextRetryAt: completedAt,
      lastSyncedAt: completedAt,
      lastError: null,
      updatedAt: completedAt,
    }).where(eq(gigCalendarSync.gigId, gigId))
    return { status: 'synced' as const, eventId }
  } catch (error) {
    const retryCount = state.retryCount + 1
    const failedAt = new Date()
    await db.update(gigCalendarSync).set({
      status: 'failed',
      retryCount,
      nextRetryAt: new Date(failedAt.getTime() + calendarRetryDelayMs(retryCount)),
      lastError: errorText(error),
      updatedAt: failedAt,
    }).where(eq(gigCalendarSync.gigId, gigId))
    throw error
  }
}

export async function processDueCalendarSyncs(limit = 10) {
  const settings = await getCalendarSyncSettings()
  if (!settings.enabled) return { processed: 0, failed: 0 }

  const due = await db
    .select({ gigId: gigCalendarSync.gigId })
    .from(gigCalendarSync)
    .where(and(
      inArray(gigCalendarSync.status, ['pending', 'failed']),
      lte(gigCalendarSync.nextRetryAt, new Date()),
    ))
    .limit(limit)

  let failed = 0
  for (const item of due) {
    try {
      await syncGigToCalendar(item.gigId)
    } catch {
      failed += 1
    }
  }
  return { processed: due.length, failed }
}

export async function syncAllCalendarGigs() {
  const rows = await db
    .select({ id: gigs.id })
    .from(gigs)
    .where(isNull(gigs.deletedAt))

  for (const gig of rows) await queueCalendarSync(gig.id)

  let failed = 0
  for (const gig of rows) {
    try {
      await syncGigToCalendar(gig.id)
    } catch {
      failed += 1
    }
  }
  return { processed: rows.length, failed }
}
