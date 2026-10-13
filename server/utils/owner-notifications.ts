import { and, eq, isNull } from 'drizzle-orm'
import { businessSettings, gigs, outboxEvents } from '../../db/schema'
import { renderBrandedEmailHtml } from '../../shared/email-automation'
import { leadFollowUp } from '../../shared/lead-followup'
import {
  isOwnerNotificationKind,
  OWNER_NOTIFICATION_MAX_ATTEMPTS,
  OWNER_NOTIFICATION_RETRY_MS,
  ownerNotificationMessage,
  type OwnerNotificationKind,
  type OwnerNotificationPayload,
} from '../../shared/owner-notifications'
import { db } from './db'
import { loadEmailBranding } from './email-branding'
import { sendEmail } from './email-provider'
import { gigTitleSql } from './gig-title'

const EVENT_TYPE = 'owner_notification'

type OutboxValues = typeof outboxEvents.$inferInsert

/**
 * Outbox row for a notification. Callers inside a transaction insert it with the business
 * change (`onConflictDoNothing` on the dedupe key); everyone else uses `queueOwnerNotification`.
 */
export function ownerNotificationOutboxValues(kind: OwnerNotificationKind, aggregateId: string, payload: OwnerNotificationPayload, dedupeSuffix = aggregateId): OutboxValues {
  return {
    type: EVENT_TYPE,
    aggregateType: kind,
    aggregateId,
    dedupeKey: `owner:${kind}:${dedupeSuffix}`,
    payload: { kind, ...payload },
  }
}

function logFailure(event: string, error: unknown, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    level: 'error',
    event,
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  }))
}

/**
 * Queues a notification and tries to deliver it right away. Never throws: a notification
 * that cannot be queued or sent must not break the inquiry, payment or portal flow that caused it.
 * The email worker retries whatever stays undelivered.
 */
export async function queueOwnerNotification(kind: OwnerNotificationKind, aggregateId: string, payload: OwnerNotificationPayload, dedupeSuffix?: string) {
  try {
    const inserted = await db.insert(outboxEvents).values(ownerNotificationOutboxValues(kind, aggregateId, payload, dedupeSuffix))
      .onConflictDoNothing({ target: outboxEvents.dedupeKey })
      .returning({ id: outboxEvents.id })
    if (inserted.length) void consumeOwnerNotifications().catch(error => logFailure('owner_notification_delivery_failed', error))
  }
  catch (error) {
    logFailure('owner_notification_queue_failed', error, { kind })
  }
}

export async function loadOwnerNotificationSettings() {
  const [settings] = await db.select({
    email: businessSettings.ownerNotificationEmail,
    kinds: businessSettings.ownerNotificationKinds,
  }).from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  return { email: settings?.email?.trim() || '', kinds: (settings?.kinds || []).filter(isOwnerNotificationKind) }
}

export async function buildOwnerNotificationEmail(kind: OwnerNotificationKind, payload: OwnerNotificationPayload) {
  const branding = await loadEmailBranding('owner_notification')
  const message = ownerNotificationMessage(kind, payload, branding.siteUrl || '')
  return {
    subject: message.subject,
    text: `${message.text}\n\n${message.variables.adminUrl || ''}`.trim(),
    html: renderBrandedEmailHtml(message.templateKey, message.text, message.variables, branding),
  }
}

let delivering = false

/** Delivers due notifications. Failed ones are retried a few times and then dropped with the reason in the payload. */
export async function consumeOwnerNotifications(limit = 20) {
  if (delivering) return 0
  delivering = true
  try {
    const events = await db.select().from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), eq(outboxEvents.type, EVENT_TYPE)))
      .orderBy(outboxEvents.occurredAt)
      .limit(limit)
    if (!events.length) return 0

    const settings = await loadOwnerNotificationSettings()
    let handled = 0
    for (const event of events) {
      const kind = event.payload.kind
      const attempts = Number(event.payload.attempts) || 0
      const retryAt = Number(event.payload.retryAt) || 0
      if (retryAt > Date.now()) continue

      const done = (extra: Record<string, unknown> = {}) => db.update(outboxEvents)
        .set({ processedAt: new Date(), payload: { ...event.payload, ...extra } })
        .where(eq(outboxEvents.id, event.id))

      if (!isOwnerNotificationKind(kind) || !settings.email || !settings.kinds.includes(kind)) {
        await done({ skipped: true })
        continue
      }

      try {
        const email = await buildOwnerNotificationEmail(kind, event.payload as OwnerNotificationPayload)
        await sendEmail({ to: settings.email, idempotencyKey: event.dedupeKey, ...email })
        await done({ sentAt: new Date().toISOString() })
        handled += 1
      }
      catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
        if (attempts + 1 >= OWNER_NOTIFICATION_MAX_ATTEMPTS) {
          await done({ failed: true, attempts: attempts + 1, lastError: message })
          logFailure('owner_notification_gave_up', error, { kind })
        }
        else {
          await db.update(outboxEvents)
            .set({ payload: { ...event.payload, attempts: attempts + 1, lastError: message, retryAt: Date.now() + OWNER_NOTIFICATION_RETRY_MS } })
            .where(eq(outboxEvents.id, event.id))
        }
      }
    }
    return handled
  }
  finally {
    delivering = false
  }
}

/** Reminders only cover recent leads, so rolling this out does not mail about every old request. */
const LEAD_REMINDER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Queues a reminder for every open lead that needs the owner now: unanswered after a day, or
 * with a follow-up date that has come. Once per lead and moment, so it is safe to call every minute.
 */
export async function queueDueLeadReminders(now = new Date()) {
  const settings = await loadOwnerNotificationSettings()
  if (!settings.email || !settings.kinds.includes('lead_followup')) return 0

  const leads = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      createdAt: gigs.createdAt,
      startsAt: gigs.startsAt,
      lastContactedAt: gigs.lastContactedAt,
      followUpAt: gigs.followUpAt,
    })
    .from(gigs)
    .where(and(eq(gigs.status, 'lead'), isNull(gigs.deletedAt)))
    .limit(500)

  let queued = 0
  for (const lead of leads) {
    const followUp = leadFollowUp(lead, now)
    if (!followUp || (followUp.state !== 'respond' && followUp.state !== 'follow_up') || !followUp.dueAt) continue
    if (followUp.dueAt.getTime() < now.getTime() - LEAD_REMINDER_WINDOW_MS) continue
    await queueOwnerNotification('lead_followup', lead.id, {
      gigId: lead.id,
      gigTitle: lead.title,
      state: followUp.state,
      receivedOn: lead.createdAt.toISOString().slice(0, 10),
      eventDate: lead.startsAt?.toISOString().slice(0, 10) ?? null,
    }, `${lead.id}:${followUp.state}:${followUp.dueAt.toISOString()}`)
    queued += 1
  }
  return queued
}
