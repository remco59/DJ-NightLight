import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import {
  clients,
  contractSubmissions,
  emailDeliveryAttempts,
  emailJobs,
  emailTemplates,
  gigEmailSuppressions,
  gigs,
  invoices,
  outboxEvents,
} from '../../db/schema'
import {
  emailRetryDelayMs,
  formatMoney,
  renderEmailTemplate,
  type EmailVariables,
} from '../../shared/email-automation'
import { db } from './db'
import { sendEmail } from './email-provider'

function clientName(input: { firstName: string | null, lastName: string | null, companyName: string | null }) {
  return input.companyName || [input.firstName, input.lastName].filter(Boolean).join(' ') || 'daar'
}

function fmt(value: Date | string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(value))
}

export async function loadGigEmailContext(gigId: string) {
  const [row] = await db
    .select({
      gigId: gigs.id,
      gigTitle: gigs.title,
      gigStatus: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      clientEmail: clients.email,
      firstName: clients.firstName,
      lastName: clients.lastName,
      companyName: clients.companyName,
    })
    .from(gigs)
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .where(and(eq(gigs.id, gigId), isNull(gigs.deletedAt)))
    .limit(1)
  if (!row?.clientEmail) return null

  const config = useRuntimeConfig()
  const emailConfig = config.email as { reviewUrl?: string }
  return {
    recipient: row.clientEmail,
    status: row.gigStatus,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    variables: {
      clientName: clientName(row),
      gigTitle: row.gigTitle,
      gigDate: fmt(row.startsAt),
      reviewUrl: emailConfig.reviewUrl || '',
    } satisfies EmailVariables,
  }
}

export async function loadInvoiceEmailContext(invoiceId: string) {
  const [row] = await db
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
      paymentStatus: invoices.paymentStatus,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      currency: invoices.currency,
      gigId: invoices.gigId,
      gigTitle: gigs.title,
      clientEmail: clients.email,
      firstName: clients.firstName,
      lastName: clients.lastName,
      companyName: clients.companyName,
    })
    .from(invoices)
    .innerJoin(gigs, eq(invoices.gigId, gigs.id))
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)
  if (!row?.clientEmail) return null
  return {
    recipient: row.clientEmail,
    gigId: row.gigId,
    status: row.invoiceStatus,
    paymentStatus: row.paymentStatus,
    dueDate: row.dueDate,
    variables: {
      clientName: clientName(row),
      gigTitle: row.gigTitle,
      invoiceNumber: row.invoiceNumber || '',
      invoiceTotal: formatMoney(row.totalCents, row.currency),
      invoiceDueDate: row.dueDate,
    } satisfies EmailVariables,
  }
}

export async function queueEmailJob(input: {
  templateKey: string
  recipient: string
  variables: EmailVariables
  dedupeKey: string
  gigId?: string | null
  invoiceId?: string | null
  runAt?: Date
}) {
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.templateKey)).limit(1)
  if (!template?.enabled) return null
  const runAt = input.runAt || new Date(Date.now() + template.offsetMinutes * 60_000)
  const [job] = await db.insert(emailJobs).values({
    templateKey: input.templateKey,
    recipient: input.recipient,
    variables: input.variables as Record<string, string | number | null>,
    dedupeKey: input.dedupeKey,
    gigId: input.gigId || null,
    invoiceId: input.invoiceId || null,
    runAt,
  }).onConflictDoNothing({ target: emailJobs.dedupeKey }).returning()
  return job || null
}

export async function queueGigEmail(templateKey: string, gigId: string, dedupeKey: string, extra: EmailVariables = {}) {
  const context = await loadGigEmailContext(gigId)
  if (!context) return null
  return queueEmailJob({
    templateKey,
    gigId,
    recipient: context.recipient,
    variables: { ...context.variables, ...extra },
    dedupeKey,
  })
}

export async function queuePortalEmails(gigId: string, portalUrl: string, portalLinkId: string) {
  const context = await loadGigEmailContext(gigId)
  if (!context) return
  await queueEmailJob({
    templateKey: 'client_portal_invitation',
    gigId,
    recipient: context.recipient,
    variables: { ...context.variables, portalUrl },
    dedupeKey: `portal-invitation:${portalLinkId}`,
  })

  const [reminder] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, 'portal_reminder')).limit(1)
  if (reminder?.enabled && context.startsAt) {
    const runAt = new Date(new Date(context.startsAt).getTime() + reminder.offsetMinutes * 60_000)
    if (runAt.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
      await queueEmailJob({
        templateKey: 'portal_reminder',
        gigId,
        recipient: context.recipient,
        variables: { ...context.variables, portalUrl },
        dedupeKey: `portal-reminder:${portalLinkId}`,
        runAt,
      })
    }
  }
}

export async function queueInvoiceEmail(templateKey: string, invoiceId: string, dedupeKey: string) {
  const context = await loadInvoiceEmailContext(invoiceId)
  if (!context) return null
  return queueEmailJob({
    templateKey,
    invoiceId,
    gigId: context.gigId,
    recipient: context.recipient,
    variables: context.variables,
    dedupeKey,
  })
}

async function isSuppressed(gigId: string | null, templateKey: string) {
  if (!gigId) return false
  const [row] = await db.select({ id: gigEmailSuppressions.id })
    .from(gigEmailSuppressions)
    .where(and(eq(gigEmailSuppressions.gigId, gigId), eq(gigEmailSuppressions.templateKey, templateKey)))
    .limit(1)
  return Boolean(row)
}

async function shouldSkipCurrentState(job: typeof emailJobs.$inferSelect) {
  if (job.templateKey === 'portal_reminder' && job.gigId) {
    const [submission] = await db.select({ status: contractSubmissions.status })
      .from(contractSubmissions).where(eq(contractSubmissions.gigId, job.gigId)).limit(1)
    if (submission?.status === 'submitted') return 'Client portal was already submitted'
  }

  if (['pre_gig_reminder', 'thank_you', 'review_request', 'booking_accepted'].includes(job.templateKey) && job.gigId) {
    const [gig] = await db.select({ status: gigs.status }).from(gigs).where(eq(gigs.id, job.gigId)).limit(1)
    if (!gig || gig.status !== 'booked') return 'Gig is no longer booked'
  }

  if (['payment_reminder', 'overdue_reminder', 'invoice_sent', 'payment_received'].includes(job.templateKey) && job.invoiceId) {
    const [invoice] = await db.select({ status: invoices.status, paymentStatus: invoices.paymentStatus })
      .from(invoices).where(eq(invoices.id, job.invoiceId)).limit(1)
    if (!invoice || invoice.status === 'void') return 'Invoice is no longer payable'
    if (['payment_reminder', 'overdue_reminder'].includes(job.templateKey) && invoice.paymentStatus === 'paid') return 'Invoice is already paid'
  }
  return null
}

export async function processEmailJob(jobId: string) {
  const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId)).limit(1)
  if (!job || !['pending', 'failed'].includes(job.status)) return { status: 'ignored' as const }

  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, job.templateKey)).limit(1)
  const skipReason = !template?.enabled
    ? 'Template is disabled'
    : await isSuppressed(job.gigId, job.templateKey)
      ? 'Automation is suppressed for this gig'
      : await shouldSkipCurrentState(job)

  if (skipReason) {
    await db.update(emailJobs).set({
      status: 'suppressed',
      lastError: skipReason,
      updatedAt: new Date(),
    }).where(eq(emailJobs.id, job.id))
    return { status: 'suppressed' as const }
  }

  if (!template) return { status: 'missing-template' as const }
  await db.update(emailJobs).set({ status: 'processing', updatedAt: new Date() }).where(eq(emailJobs.id, job.id))

  const subject = renderEmailTemplate(template.subject, job.variables)
  const text = renderEmailTemplate(template.body, job.variables)
  try {
    const sent = await sendEmail({ to: job.recipient, subject, text })
    const sentAt = new Date()
    await db.transaction(async (tx) => {
      await tx.insert(emailDeliveryAttempts).values({
        jobId: job.id,
        status: 'sent',
        providerMessageId: sent.id,
      })
      await tx.update(emailJobs).set({
        status: 'sent',
        attemptCount: job.attemptCount + 1,
        lastError: null,
        sentAt,
        updatedAt: sentAt,
      }).where(eq(emailJobs.id, job.id))
    })
    return { status: 'sent' as const }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1500) : String(error).slice(0, 1500)
    const attemptCount = job.attemptCount + 1
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.insert(emailDeliveryAttempts).values({ jobId: job.id, status: 'failed', error: message })
      await tx.update(emailJobs).set({
        status: 'failed',
        attemptCount,
        runAt: new Date(now.getTime() + emailRetryDelayMs(attemptCount)),
        lastError: message,
        updatedAt: now,
      }).where(eq(emailJobs.id, job.id))
    })
    throw error
  }
}

export async function processDueEmailJobs(limit = 10) {
  const due = await db.select({ id: emailJobs.id }).from(emailJobs)
    .where(and(
      inArray(emailJobs.status, ['pending', 'failed']),
      ne(emailJobs.attemptCount, 8),
    ))
    .orderBy(emailJobs.runAt)
    .limit(limit)

  const now = Date.now()
  let processed = 0
  let failed = 0
  for (const item of due) {
    const [job] = await db.select({ runAt: emailJobs.runAt }).from(emailJobs).where(eq(emailJobs.id, item.id)).limit(1)
    if (!job || new Date(job.runAt).getTime() > now) continue
    processed += 1
    try { await processEmailJob(item.id) } catch { failed += 1 }
  }
  return { processed, failed }
}

export async function consumeEmailOutbox(limit = 20) {
  const events = await db.select().from(outboxEvents)
    .where(and(isNull(outboxEvents.processedAt), eq(outboxEvents.type, 'payment_received_email')))
    .limit(limit)

  for (const event of events) {
    const invoiceId = String(event.payload.invoiceId || event.aggregateId)
    await queueInvoiceEmail('payment_received', invoiceId, `payment-received:${invoiceId}`)
    await db.update(outboxEvents).set({ processedAt: new Date() }).where(eq(outboxEvents.id, event.id))
  }
  return events.length
}

function withinSchedulingWindow(runAt: Date) {
  const now = Date.now()
  return runAt.getTime() >= now - 24 * 60 * 60 * 1000
    && runAt.getTime() <= now + 180 * 24 * 60 * 60 * 1000
}

export async function materializeScheduledEmailJobs() {
  const templates = await db.select().from(emailTemplates)
    .where(and(eq(emailTemplates.enabled, true), inArray(emailTemplates.scheduleAnchor, ['gig_start', 'gig_end', 'invoice_due'])))

  const gigTemplates = templates.filter(template => template.scheduleAnchor === 'gig_start' || template.scheduleAnchor === 'gig_end')
  if (gigTemplates.length) {
    const rows = await db
      .select({
        gigId: gigs.id,
        startsAt: gigs.startsAt,
        endsAt: gigs.endsAt,
        clientEmail: clients.email,
        firstName: clients.firstName,
        lastName: clients.lastName,
        companyName: clients.companyName,
        title: gigs.title,
      })
      .from(gigs)
      .leftJoin(clients, eq(gigs.clientId, clients.id))
      .where(and(eq(gigs.status, 'booked'), isNull(gigs.deletedAt)))
      .limit(500)

    const config = useRuntimeConfig()
    const reviewUrl = (config.email as { reviewUrl?: string }).reviewUrl || ''
    for (const template of gigTemplates) {
      if (template.key === 'portal_reminder') continue
      for (const row of rows) {
        if (!row.clientEmail) continue
        const anchor = template.scheduleAnchor === 'gig_end' ? (row.endsAt || row.startsAt) : row.startsAt
        if (!anchor) continue
        const runAt = new Date(new Date(anchor).getTime() + template.offsetMinutes * 60_000)
        if (!withinSchedulingWindow(runAt)) continue
        await queueEmailJob({
          templateKey: template.key,
          gigId: row.gigId,
          recipient: row.clientEmail,
          variables: {
            clientName: clientName(row),
            gigTitle: row.title,
            gigDate: fmt(row.startsAt),
            reviewUrl,
          },
          dedupeKey: `scheduled:${template.key}:${row.gigId}:${new Date(anchor).toISOString()}`,
          runAt,
        })
      }
    }
  }

  const invoiceTemplates = templates.filter(template => template.scheduleAnchor === 'invoice_due')
  if (invoiceTemplates.length) {
    const rows = await db
      .select({ id: invoices.id, dueDate: invoices.dueDate })
      .from(invoices)
      .where(and(eq(invoices.status, 'finalized'), ne(invoices.paymentStatus, 'paid')))
      .limit(500)
    for (const template of invoiceTemplates) {
      for (const row of rows) {
        const anchor = new Date(`${row.dueDate}T12:00:00.000Z`)
        const runAt = new Date(anchor.getTime() + template.offsetMinutes * 60_000)
        if (!withinSchedulingWindow(runAt)) continue
        const context = await loadInvoiceEmailContext(row.id)
        if (!context) continue
        await queueEmailJob({
          templateKey: template.key,
          invoiceId: row.id,
          gigId: context.gigId,
          recipient: context.recipient,
          variables: context.variables,
          dedupeKey: `scheduled:${template.key}:${row.id}:${row.dueDate}`,
          runAt,
        })
      }
    }
  }
}

export async function queueTestEmail(templateKey: string, recipient: string, variables: EmailVariables) {
  return queueEmailJob({
    templateKey,
    recipient,
    variables,
    dedupeKey: `test:${randomUUID()}`,
    runAt: new Date(),
  })
}
