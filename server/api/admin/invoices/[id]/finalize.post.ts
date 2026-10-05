import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { auditLogs, businessSettings, invoices, portalLinks } from '../../../../../db/schema'
import { calculateInvoiceTotals, formatInvoiceNumber } from '../../../../../shared/invoice'
import { db } from '../../../../utils/db'
import { queueInvoiceEmail } from '../../../../utils/email-automation'
import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { buildInvoiceSnapshot, INVOICE_SENT_TEMPLATE, invoiceFinalizeBlockers, invoiceLineInputs, loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { createPortalToken, hashPortalToken, portalExpiry } from '../../../../utils/portal-token'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  if (detail.invoice.status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'De factuur is al definitief' })
  const blockers = invoiceFinalizeBlockers(detail, await loadBusinessSettings())
  if (blockers.length) throw createError({ statusCode: 422, statusMessage: blockers.join(' ') })
  const totals = calculateInvoiceTotals(invoiceLineInputs(detail), detail.invoice.vatMode, detail.invoice.vatRateBasisPoints)
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const portalToken = createPortalToken()
  const dueAt = new Date(`${detail.invoice.dueDate}T23:59:59.999Z`)
  const daysUntilDue = Math.ceil((dueAt.getTime() - Date.now()) / 86_400_000)
  const portalExpiresInDays = Math.min(365, Math.max(30, daysUntilDue + 30))
  const portalExpiresAt = portalExpiry(portalExpiresInDays)
  const portalUrl = `${baseUrl}/client/${portalToken}`

  const finalized = await db.transaction(async (tx) => {
    const [settings] = await tx.update(businessSettings).set({ nextInvoiceNumber: sql`${businessSettings.nextInvoiceNumber} + 1` }).where(eq(businessSettings.key, 'default')).returning()
    if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })
    const sequence = settings.nextInvoiceNumber - 1
    const invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, Number(detail.invoice.issueDate.slice(0, 4)), sequence)
    const [portalLink] = await tx.insert(portalLinks).values({
      gigId: detail.invoice.gigId,
      tokenHash: hashPortalToken(portalToken),
      expiresAt: portalExpiresAt,
      createdByUserId: user.id,
    }).returning({ id: portalLinks.id })
    if (!portalLink) throw createError({ statusCode: 500, statusMessage: 'Klantportaallink aanmaken is niet gelukt' })
    const snapshot = buildInvoiceSnapshot(detail, settings, invoiceNumber, portalUrl)
    const documentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    const [invoice] = await tx.update(invoices).set({
      invoiceNumber, status: 'finalized', ...totals, documentSnapshot: snapshot, documentHash, finalizedAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(invoices.id, id), eq(invoices.status, 'draft'))).returning()
    if (!invoice) throw createError({ statusCode: 409, statusMessage: 'De factuur is intussen via een ander verzoek definitief gemaakt' })
    await tx.insert(auditLogs).values([
      { userId: user.id, entityType: 'invoice', entityId: id, action: 'invoice_finalized', metadata: { invoiceNumber, documentHash } },
      { userId: user.id, entityType: 'gig', entityId: detail.invoice.gigId, action: 'portal_link_created', metadata: { linkId: portalLink.id, expiresAt: portalExpiresAt.toISOString(), source: 'invoice_finalized' } },
    ])
    return invoice
  })
  const job = await queueInvoiceEmail(INVOICE_SENT_TEMPLATE, finalized.id, `invoice-sent:${finalized.id}`)
  return { invoice: finalized, email: job ? { recipient: job.recipient, runAt: job.runAt } : null }
})
