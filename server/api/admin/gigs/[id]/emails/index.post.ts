import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { emailTemplates, invoices } from '../../../../../../db/schema'
import {
  EMAIL_ATTACHMENT_EXTENSIONS,
  MAX_EMAIL_ATTACHMENTS,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  MAX_EMAIL_ATTACHMENT_BYTES,
  attachmentExtension,
  sanitizeAttachmentFilename,
  type EmailAttachment,
} from '../../../../../../shared/email-automation'
import { recordAudit } from '../../../../../utils/audit'
import { db } from '../../../../../utils/db'
import { loadGigEmailDetails, processEmailJob, queueManualEmail } from '../../../../../utils/email-automation'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { requireStaff } from '../../../../../utils/require-staff'

const schema = z.object({
  templateKey: z.string().min(1).max(80),
  recipient: z.string().trim().toLowerCase().pipe(z.email()),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  variables: z.record(z.string(), z.union([z.string().max(2000), z.number(), z.null()])).default({}),
  invoiceIds: z.array(z.uuid()).max(MAX_EMAIL_ATTACHMENTS).default([]),
})

function parseJson(value: string, fallback: unknown) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Ongeldig e-mailformulier' })
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })

  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Multipart-formulier is verplicht' })
  const text = (name: string) => parts.find(part => part.name === name && !part.filename)?.data?.toString('utf8') || ''
  const parsed = schema.safeParse({
    templateKey: text('templateKey'),
    recipient: text('recipient'),
    subject: text('subject'),
    body: text('body'),
    variables: parseJson(text('variables'), {}),
    invoiceIds: parseJson(text('invoiceIds'), []),
  })
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldig e-mailformulier' })
  }
  const input = parsed.data

  const details = await loadGigEmailDetails(gigId)
  if (!details) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  const [template] = await db.select({ key: emailTemplates.key }).from(emailTemplates).where(eq(emailTemplates.key, input.templateKey)).limit(1)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template niet gevonden' })

  const files = parts.filter(part => part.name === 'attachments' && part.filename && part.data?.length)
  if (files.length + input.invoiceIds.length > MAX_EMAIL_ATTACHMENTS) {
    throw createError({ statusCode: 422, statusMessage: `Voeg maximaal ${MAX_EMAIL_ATTACHMENTS} bijlagen toe` })
  }
  let totalBytes = 0
  for (const file of files) {
    const filename = sanitizeAttachmentFilename(file.filename || '')
    if (!EMAIL_ATTACHMENT_EXTENSIONS.includes(attachmentExtension(filename))) {
      throw createError({ statusCode: 422, statusMessage: `${filename} is geen toegestaan bestandstype` })
    }
    if (file.data.length > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw createError({ statusCode: 413, statusMessage: `${filename} is groter dan 10 MB` })
    }
    totalBytes += file.data.length
  }
  if (totalBytes > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Bijlagen mogen samen maximaal 20 MB zijn' })
  }

  const invoiceRows = input.invoiceIds.length
    ? await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(and(
        inArray(invoices.id, input.invoiceIds),
        eq(invoices.gigId, gigId),
        eq(invoices.status, 'finalized'),
        isNotNull(invoices.invoiceNumber),
      ))
    : []
  if (invoiceRows.length !== new Set(input.invoiceIds).size) {
    throw createError({ statusCode: 422, statusMessage: 'Alleen definitieve facturen van deze gig kunnen worden bijgevoegd' })
  }

  const storage = getMediaStorage()
  const attachments: EmailAttachment[] = invoiceRows.map(invoice => ({
    kind: 'invoice',
    invoiceId: invoice.id,
    filename: `Factuur ${invoice.invoiceNumber}.pdf`,
  }))
  for (const file of files) {
    const filename = sanitizeAttachmentFilename(file.filename || '')
    const storageKey = await storage.put(file.data, attachmentExtension(filename), 'email-attachments')
    attachments.push({
      kind: 'file',
      storageKey,
      filename,
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.data.length,
    })
  }

  const job = await queueManualEmail({
    templateKey: template.key,
    gigId,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    variables: { ...details.variables, ...input.variables },
    attachments,
    userId: user.id,
  })
  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: gigId,
    action: 'email_sent_manually',
    metadata: { jobId: job.id, templateKey: template.key, recipient: input.recipient, attachments: attachments.map(item => item.filename) },
  })

  try {
    const result = await processEmailJob(job.id)
    return { jobId: job.id, status: result.status }
  } catch (error) {
    // The job is stored as failed and the email worker retries it with backoff.
    return {
      jobId: job.id,
      status: 'failed' as const,
      error: error instanceof Error ? error.message : 'E-mail kon niet worden verstuurd',
    }
  }
})
