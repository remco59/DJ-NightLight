import { and, eq } from 'drizzle-orm'
import { auditLogs, invoices, payments } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

/** Undoes a manually recorded payment. Stripe payments are never undone here. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })

  const invoice = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(and(eq(payments.invoiceId, id), eq(payments.provider, 'manual'))).limit(1)
    if (!payment) throw createError({ statusCode: 409, statusMessage: 'Alleen een handmatig geregistreerde betaling kan worden teruggedraaid.' })
    await tx.delete(payments).where(eq(payments.id, payment.id))
    const [updated] = await tx.update(invoices).set({ paymentStatus: 'unpaid', updatedAt: new Date() }).where(eq(invoices.id, id)).returning()
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: id, action: 'manual_payment_removed', metadata: { paidAt: payment.paidAt } })
    return updated
  })
  return { invoice }
})
