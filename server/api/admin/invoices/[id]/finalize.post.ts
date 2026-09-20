import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { auditLogs, businessSettings, invoices } from '../../../../../db/schema'
import { calculateInvoiceTotals, calculateLineTotalCents, formatInvoiceNumber, type InvoiceSnapshot } from '../../../../../shared/invoice'
import { db } from '../../../../utils/db'
import { queueInvoiceEmail } from '../../../../utils/email-automation'
import { getInvoiceDetail, invoiceClientName } from '../../../../utils/invoice-data'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invoice id is required' })
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  if (detail.invoice.status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'Invoice is already finalized' })
  const lineInputs = detail.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents }))
  const totals = calculateInvoiceTotals(lineInputs, detail.invoice.vatMode, detail.invoice.vatRateBasisPoints)

  const finalized = await db.transaction(async (tx) => {
    const [settings] = await tx.update(businessSettings).set({ nextInvoiceNumber: sql`${businessSettings.nextInvoiceNumber} + 1` }).where(eq(businessSettings.key, 'default')).returning()
    if (!settings) throw createError({ statusCode: 500, statusMessage: 'Business settings are not initialized' })
    const sequence = settings.nextInvoiceNumber - 1
    const invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, Number(detail.invoice.issueDate.slice(0, 4)), sequence)
    const snapshot: InvoiceSnapshot = {
      invoiceNumber, issueDate: detail.invoice.issueDate, dueDate: detail.invoice.dueDate, currency: detail.invoice.currency,
      vatMode: detail.invoice.vatMode, vatRateBasisPoints: detail.invoice.vatRateBasisPoints,
      business: {
        companyName: settings.companyName, address: settings.address, postalCode: settings.postalCode, city: settings.city,
        country: settings.country, email: settings.email, phone: settings.phone, registrationNumber: settings.registrationNumber,
        vatNumber: settings.vatNumber, iban: settings.iban,
      },
      client: { name: invoiceClientName(detail.invoice), email: detail.invoice.clientEmail || '', billingAddress: detail.invoice.clientBillingAddress || '' },
      lines: lineInputs.map(line => ({ ...line, totalCents: calculateLineTotalCents(line) })), totals,
      paymentTerms: detail.invoice.paymentTerms, legalText: detail.invoice.legalText, notes: detail.invoice.notes,
    }
    const documentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    const [invoice] = await tx.update(invoices).set({
      invoiceNumber, status: 'finalized', ...totals, documentSnapshot: snapshot, documentHash, finalizedAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(invoices.id, id), eq(invoices.status, 'draft'))).returning()
    if (!invoice) throw createError({ statusCode: 409, statusMessage: 'Invoice was finalized by another request' })
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: id, action: 'invoice_finalized', metadata: { invoiceNumber, documentHash } })
    return invoice
  })
  await queueInvoiceEmail('invoice_sent', finalized.id, `invoice-sent:${finalized.id}`)
  return { invoice: finalized }
})
