import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { emailJobs, emailTemplates, invoices } from '../../../../../../db/schema'
import { formatMoney, isAutomaticEmailTemplate } from '../../../../../../shared/email-automation'
import { db } from '../../../../../utils/db'
import { loadGigEmailDetails } from '../../../../../utils/email-automation'
import { emailProviderConfigured } from '../../../../../utils/email-provider'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })

  const details = await loadGigEmailDetails(gigId)
  if (!details) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  const templates = await db.select({
    key: emailTemplates.key,
    name: emailTemplates.name,
    enabled: emailTemplates.enabled,
    subject: emailTemplates.subject,
    body: emailTemplates.body,
    scheduleAnchor: emailTemplates.scheduleAnchor,
    offsetMinutes: emailTemplates.offsetMinutes,
  }).from(emailTemplates).orderBy(asc(emailTemplates.name))

  const finalizedInvoices = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    dueDate: invoices.dueDate,
    totalCents: invoices.totalCents,
    currency: invoices.currency,
    paymentStatus: invoices.paymentStatus,
  }).from(invoices)
    .where(and(eq(invoices.gigId, gigId), eq(invoices.status, 'finalized'), isNotNull(invoices.invoiceNumber)))
    .orderBy(desc(invoices.finalizedAt))

  const jobs = await db.select({
    id: emailJobs.id,
    templateKey: emailJobs.templateKey,
    recipient: emailJobs.recipient,
    status: emailJobs.status,
    runAt: emailJobs.runAt,
    sentAt: emailJobs.sentAt,
    lastError: emailJobs.lastError,
    manual: emailJobs.manual,
    subjectOverride: emailJobs.subjectOverride,
    attachments: emailJobs.attachments,
    variables: emailJobs.variables,
    createdAt: emailJobs.createdAt,
  }).from(emailJobs)
    .where(eq(emailJobs.gigId, gigId))
    .orderBy(desc(emailJobs.createdAt))
    .limit(50)

  const latestInvoice = finalizedInvoices[0]
  const { row } = details
  return {
    providerConfigured: await emailProviderConfigured(),
    client: row.clientId
      ? {
          id: row.clientId,
          name: details.variables.clientName,
          email: row.clientEmail,
          emailAutomationDisabled: row.emailAutomationDisabled || [],
        }
      : null,
    variables: {
      ...details.variables,
      ...(latestInvoice
        ? {
            invoiceNumber: latestInvoice.invoiceNumber,
            invoiceTotal: formatMoney(latestInvoice.totalCents, latestInvoice.currency),
            invoiceDueDate: latestInvoice.dueDate,
          }
        : {}),
    },
    templates: templates.map(template => ({ ...template, automatic: isAutomaticEmailTemplate(template.key) })),
    invoices: finalizedInvoices.map(invoice => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus })),
    jobs: jobs.map(job => ({
      ...job,
      attachments: job.attachments.map(attachment => attachment.filename),
      // Automatic emails can be edited and sent by hand, starting from their own details.
      variables: job.manual ? null : job.variables,
    })),
  }
})
