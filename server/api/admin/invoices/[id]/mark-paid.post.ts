import { and, eq, ne } from 'drizzle-orm'
import { auditLogs, invoices, payments } from '../../../../../db/schema'
import { manualPaymentSchema } from '../../../../../shared/schemas/manual-payment'
import { db } from '../../../../utils/db'
import { queueInvoiceEmail } from '../../../../utils/email-automation'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/**
 * Records a payment that did not go through Stripe (bank transfer, cash).
 * Marking the invoice paid also stops pending payment reminders: they are
 * skipped at send time for paid invoices.
 */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const parsed = manualPaymentSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige betaling' })
  const input = parsed.data
  const paidAt = new Date(`${input.paidOn}T12:00:00.000Z`)
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 36 * 3600_000) {
    throw createError({ statusCode: 422, statusMessage: 'De betaaldatum kan niet in de toekomst liggen.' })
  }

  const invoice = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1)
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
    if (current.status !== 'finalized') throw createError({ statusCode: 409, statusMessage: 'Alleen een definitieve factuur kan als betaald worden gemarkeerd.' })
    if (current.paymentStatus === 'paid') throw createError({ statusCode: 409, statusMessage: 'Deze factuur is al betaald.' })

    const metadata = { manual: true, method: input.method, note: input.note, recordedByUserId: user.id }
    const [existing] = await tx.select().from(payments).where(eq(payments.invoiceId, id)).limit(1)
    const values = { provider: 'manual', amountCents: current.totalCents, currency: current.currency, status: 'succeeded' as const, paidAt, failureCode: null, metadata, updatedAt: new Date() }
    if (existing) await tx.update(payments).set(values).where(eq(payments.id, existing.id))
    else await tx.insert(payments).values({ invoiceId: id, attemptCount: 0, ...values })

    const [updated] = await tx.update(invoices).set({ paymentStatus: 'paid', updatedAt: new Date() })
      .where(and(eq(invoices.id, id), ne(invoices.paymentStatus, 'paid'))).returning()
    if (!updated) throw createError({ statusCode: 409, statusMessage: 'Deze factuur is intussen al als betaald gemarkeerd.' })
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: id, action: 'payment_recorded_manually', metadata: { method: input.method, paidOn: input.paidOn, amountCents: current.totalCents } })
    return updated
  })

  const job = input.sendConfirmation
    ? await queueInvoiceEmail('payment_received', invoice.id, `payment-received:${invoice.id}`)
    : null
  return { invoice, email: job ? { recipient: job.recipient } : null }
})
