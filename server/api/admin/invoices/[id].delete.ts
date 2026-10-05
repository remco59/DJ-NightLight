import { eq } from 'drizzle-orm'
import { auditLogs, invoices, payments } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

// Finalized invoices are financial records, so only voided ones (e.g. test invoices) can be removed for good.
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  if (invoice.status !== 'void') {
    throw createError({ statusCode: 409, statusMessage: 'Alleen vervallen facturen kunnen worden verwijderd' })
  }

  const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, id)).limit(1)
  if (payment?.provider === 'manual' && payment.paidAt) {
    throw createError({ statusCode: 409, statusMessage: 'Deze factuur is als betaald gemarkeerd. Maak die markering eerst ongedaan.' })
  }
  if (payment?.paidAt) {
    throw createError({ statusCode: 409, statusMessage: 'Deze factuur heeft een betaling en kan niet worden verwijderd' })
  }

  await db.transaction(async (tx) => {
    // payments.invoice_id is ON DELETE RESTRICT; line items cascade, email jobs and replacement links are set null.
    if (payment) await tx.delete(payments).where(eq(payments.id, payment.id))
    await tx.delete(invoices).where(eq(invoices.id, id))
    await tx.insert(auditLogs).values({
      userId: user.id,
      entityType: 'invoice',
      entityId: id,
      action: 'invoice_deleted',
      metadata: { invoiceNumber: invoice.invoiceNumber, totalCents: invoice.totalCents, gigId: invoice.gigId },
    })
  })

  return { ok: true }
})
