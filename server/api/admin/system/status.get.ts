import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { and, count, desc, eq, isNull, lt } from 'drizzle-orm'
import {
  emailJobs,
  gigCalendarSync,
  outboxEvents,
  payments,
  stripeWebhookEvents,
} from '../../../../db/schema'
import { db } from '../../../utils/db'
import { loadCalendarIntegration, loadEmailIntegration } from '../../../utils/integration-settings'
import { loadRenderSettings } from '../../../utils/render-settings'
import { requireStaff } from '../../../utils/require-staff'
import { stripeStatus } from '../../../utils/stripe-settings'

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
    pendingOutboxRow,
    staleOutboxRow,
    lastStripeEvent,
    backup,
  ] = await Promise.all([
    db.select({ value: count() }).from(emailJobs).where(eq(emailJobs.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(gigCalendarSync).where(eq(gigCalendarSync.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(payments).where(eq(payments.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.processedAt)).then(rows => rows[0]),
    db.select({ value: count() }).from(outboxEvents).where(and(isNull(outboxEvents.processedAt), lt(outboxEvents.occurredAt, staleOutboxBefore))).then(rows => rows[0]),
    db.select({
      eventId: stripeWebhookEvents.eventId,
      eventType: stripeWebhookEvents.eventType,
      livemode: stripeWebhookEvents.livemode,
      processedAt: stripeWebhookEvents.processedAt,
    }).from(stripeWebhookEvents).orderBy(desc(stripeWebhookEvents.processedAt)).limit(1).then(rows => rows[0] || null),
    latestBackup(),
  ])

  const [calendar, email, stripe, render] = await Promise.all([
    loadCalendarIntegration(),
    loadEmailIntegration(),
    stripeStatus(),
    loadRenderSettings(),
  ])

  return {
    generatedAt: new Date().toISOString(),
    health: {
      failedEmails: Number(failedEmailsRow?.value || 0),
      failedCalendarSyncs: Number(failedCalendarRow?.value || 0),
      failedPayments: Number(failedPaymentsRow?.value || 0),
      pendingOutbox: Number(pendingOutboxRow?.value || 0),
      staleOutbox: Number(staleOutboxRow?.value || 0),
    },
    integrations: {
      stripe: {
        configured: stripe.keyConfigured && stripe.webhookConfigured,
        source: stripe.source,
        livemode: stripe.livemode,
        lastEvent: lastStripeEvent,
      },
      calendarConfigured: calendar.status.configured,
      calendarSource: calendar.status.source,
      emailConfigured: email.status.configured,
      emailSource: email.status.source,
    },
    renderWorker: {
      online: render.workerOnline,
      engine: render.engine,
      activeEngine: render.activeEngine,
      heartbeatAt: render.heartbeatAt,
    },
    backup,
  }
})
