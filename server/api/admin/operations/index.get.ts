import { count, desc, eq, isNull } from 'drizzle-orm'
import {
  emailJobs,
  gigCalendarSync,
  operationsEvents,
  outboxEvents,
  payments,
  stripeWebhookEvents,
} from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])

  const [
    [failedEmails],
    [failedCalendar],
    [failedPayments],
    [pendingOutbox],
    recentOps,
    recentEmailFailures,
    recentCalendarFailures,
    recentPaymentFailures,
    recentStripeEvents,
  ] = await Promise.all([
    db.select({ value: count() }).from(emailJobs).where(eq(emailJobs.status, 'failed')),
    db.select({ value: count() }).from(gigCalendarSync).where(eq(gigCalendarSync.status, 'failed')),
    db.select({ value: count() }).from(payments).where(eq(payments.status, 'failed')),
    db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.processedAt)),
    db.select().from(operationsEvents).orderBy(desc(operationsEvents.occurredAt)).limit(30),
    db.select({
      id: emailJobs.id,
      templateKey: emailJobs.templateKey,
      recipient: emailJobs.recipient,
      attemptCount: emailJobs.attemptCount,
      lastError: emailJobs.lastError,
      updatedAt: emailJobs.updatedAt,
    }).from(emailJobs).where(eq(emailJobs.status, 'failed')).orderBy(desc(emailJobs.updatedAt)).limit(10),
    db.select({
      gigId: gigCalendarSync.gigId,
      retryCount: gigCalendarSync.retryCount,
      lastError: gigCalendarSync.lastError,
      lastAttemptAt: gigCalendarSync.lastAttemptAt,
    }).from(gigCalendarSync).where(eq(gigCalendarSync.status, 'failed')).orderBy(desc(gigCalendarSync.updatedAt)).limit(10),
    db.select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      failureCode: payments.failureCode,
      updatedAt: payments.updatedAt,
    }).from(payments).where(eq(payments.status, 'failed')).orderBy(desc(payments.updatedAt)).limit(10),
    db.select().from(stripeWebhookEvents).orderBy(desc(stripeWebhookEvents.processedAt)).limit(10),
  ])

  const latest = (kind: string) => recentOps.find(item => item.kind === kind) || null

  return {
    counts: {
      failedEmails: failedEmails?.value || 0,
      failedCalendar: failedCalendar?.value || 0,
      failedPayments: failedPayments?.value || 0,
      pendingOutbox: pendingOutbox?.value || 0,
    },
    latestBackup: latest('backup'),
    latestRestoreTest: latest('restore_test'),
    recentOps,
    failures: {
      email: recentEmailFailures,
      calendar: recentCalendarFailures,
      payments: recentPaymentFailures,
    },
    stripe: {
      recentEvents: recentStripeEvents,
    },
  }
})
