import { desc, eq } from 'drizzle-orm'
import {
  emailDeliveryAttempts,
  emailJobs,
  emailTemplates,
  gigEmailSuppressions,
  gigs,
} from '../../../../db/schema'
import { db } from '../../../utils/db'
import { emailProviderConfigured } from '../../../utils/email-provider'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.name)
  const jobs = await db.select({
    id: emailJobs.id,
    templateKey: emailJobs.templateKey,
    gigId: emailJobs.gigId,
    invoiceId: emailJobs.invoiceId,
    recipient: emailJobs.recipient,
    runAt: emailJobs.runAt,
    status: emailJobs.status,
    attemptCount: emailJobs.attemptCount,
    lastError: emailJobs.lastError,
    sentAt: emailJobs.sentAt,
    createdAt: emailJobs.createdAt,
    gigTitle: gigs.title,
  }).from(emailJobs)
    .leftJoin(gigs, eq(emailJobs.gigId, gigs.id))
    .orderBy(desc(emailJobs.createdAt))
    .limit(100)

  const attempts = await db.select().from(emailDeliveryAttempts)
    .orderBy(desc(emailDeliveryAttempts.attemptedAt))
    .limit(100)

  const suppressions = await db.select({
    id: gigEmailSuppressions.id,
    gigId: gigEmailSuppressions.gigId,
    templateKey: gigEmailSuppressions.templateKey,
    gigTitle: gigs.title,
  }).from(gigEmailSuppressions)
    .innerJoin(gigs, eq(gigEmailSuppressions.gigId, gigs.id))
    .orderBy(desc(gigEmailSuppressions.createdAt))

  const gigOptions = await db.select({ id: gigs.id, title: gigs.title, startsAt: gigs.startsAt, status: gigs.status })
    .from(gigs).orderBy(desc(gigs.startsAt)).limit(150)

  return {
    providerConfigured: await emailProviderConfigured(),
    templates,
    jobs,
    attempts,
    suppressions,
    gigOptions,
  }
})
