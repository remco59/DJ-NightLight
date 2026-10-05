import { and, eq } from 'drizzle-orm'
import { auditLogs, invoiceLineItems, invoices } from '../../../../db/schema'
import { calculateInvoiceTotals, invoiceDraftInputSchema } from '../../../../shared/invoice'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })
  const parsed = invoiceDraftInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige factuur' })
  const totals = calculateInvoiceTotals(parsed.data.lines, parsed.data.vatMode, parsed.data.vatRateBasisPoints)

  const invoice = await db.transaction(async (tx) => {
    const [updated] = await tx.update(invoices).set({
      issueDate: parsed.data.issueDate, dueDate: parsed.data.dueDate, currency: parsed.data.currency,
      vatMode: parsed.data.vatMode, vatRateBasisPoints: parsed.data.vatRateBasisPoints,
      paymentTerms: parsed.data.paymentTerms, legalText: parsed.data.legalText, notes: parsed.data.notes,
      ...totals, updatedAt: new Date(),
    }).where(and(eq(invoices.id, id), eq(invoices.status, 'draft'))).returning()
    if (!updated) throw createError({ statusCode: 409, statusMessage: 'Alleen conceptfacturen kunnen worden bewerkt' })
    await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id))
    await tx.insert(invoiceLineItems).values(parsed.data.lines.map((line, ordering) => ({ invoiceId: id, ...line, ordering })))
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: id, action: 'invoice_draft_updated', metadata: totals })
    return updated
  })
  return { invoice }
})
