import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { count, desc, eq, isNull, lt } from 'drizzle-orm'
import {
  emailJobs,
  gigCalendarSync,
  outboxEvents,
  payments,
  stripeWebhookEvents,
} from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

async function latestBackup() {
  const root = String(useRuntimeConfig().storageBackups)
  try {
    const entries = (await readdir(root)).filter(name => name.startsWith('nightlight-')).sort().reverse()
    if (!entries[0]) return null
    const path = join(root, entries[0])
    const info = await stat(path)
    return { name: entries[0], updatedAt: info.mtime.toISOString() }
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])

  const staleOutboxBefore = new Date(Date.now() - 5 * 60_000)
  const [
    failedEmailsRow,
    failedCalendarRow,
    failedPaymentsRow,
    staleOutboxRow,
    lastStripeEvent,
    backup,
  ] = await Promise.all([
    db.select({ value: count() }).from(emailJobs).where(eq(emailJobs.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(gigCalendarSync).where(eq(gigCalendarSync.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(payments).where(eq(payments.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(outboxEvents).where(
      isNull(outboxEvents.processedAt)
        ? undefined
        : undefined,
    ).then(() => null).catch(() => null),
    db.select({
      eventId: stripeWebhookEvents.eventId,
      eventType: stripeWebhookEvents.eventType,
      livemode: stripeWebhookEvents.livemode,
      processedAt: stripeWebhookEvents.processedAt,
    }).from(stripeWebhookEvents).orderBy(desc(stripeWebhookEvents.processedAt)).limit(1).then(rows => rows[0] || null),
    latestBackup(),
  ])

  const [outbox] = await db.select({ value: count() }).from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
  const [staleOutbox] = await db.select({ value: count() }).from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
  const staleRows = await db.select({ occurredAt: outboxEvents.occurredAt }).from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
    .limit(100)
  const staleCount = staleRows.filter(row => row.occurredAt < staleOutboxBefore).length

  const config = useRuntimeConfig()
  const calendar = config.googleCalendar as { clientId?: string, clientSecret?: string, refreshToken?: string }
  const email = config.email as { apiKey?: string, from?: string }

  return {
    generatedAt: new Date().toISOString(),
    health: {
      failedEmails: Number(failedEmailsRow?.value || 0),
      failedCalendarSyncs: Number(failedCalendarRow?.value || 0),
      failedPayments: Number(failedPaymentsRow?.value || 0),
      pendingOutbox: Number(outbox?.value || 0),
      staleOutbox: staleCount,
    },
    integrations: {
      stripe: { lastEvent: lastStripeEvent },
      calendarConfigured: Boolean(calendar.clientId && calendar.clientSecret && calendar.refreshToken),
      emailConfigured: Boolean(email.apiKey && email.from),
    },
    backup,
  }
})
