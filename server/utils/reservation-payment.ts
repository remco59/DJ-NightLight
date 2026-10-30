import { eq } from 'drizzle-orm'
import { auditLogs, quotes, reservationPayments } from '../../db/schema'
import type { db } from './db'
import { attachReservationsToInvoice, latestOpenInvoiceId } from './invoice-balance'

type Tx = Pick<typeof db, 'select' | 'update' | 'insert'>

/**
 * Records that the reservation of a quote is paid, however it was paid, and counts it as a partial payment on the
 * gig's invoice when there is one. The quote keeps the moment, so the booking can be confirmed from it.
 */
export async function recordReservationPaid(tx: Tx, quote: { id: string, gigId: string, reservationCents: number, currency: string }, input: {
  provider: string
  paidAt: Date
  providerSessionId?: string | null
  providerPaymentIntentId?: string | null
  metadata?: Record<string, unknown>
  userId?: string | null
}) {
  const values = {
    provider: input.provider,
    amountCents: quote.reservationCents,
    currency: quote.currency,
    status: 'succeeded' as const,
    paidAt: input.paidAt,
    failureCode: null,
    metadata: input.metadata ?? null,
    updatedAt: new Date(),
    ...(input.providerSessionId ? { providerSessionId: input.providerSessionId } : {}),
    ...(input.providerPaymentIntentId ? { providerPaymentIntentId: input.providerPaymentIntentId } : {}),
  }
  const [existing] = await tx.select({ id: reservationPayments.id }).from(reservationPayments).where(eq(reservationPayments.quoteId, quote.id)).limit(1)
  if (existing) await tx.update(reservationPayments).set(values).where(eq(reservationPayments.id, existing.id))
  else await tx.insert(reservationPayments).values({ quoteId: quote.id, attemptCount: 0, ...values })
  await tx.update(quotes).set({ reservationPaidAt: input.paidAt, updatedAt: new Date() }).where(eq(quotes.id, quote.id))
  const invoiceId = await latestOpenInvoiceId(quote.gigId, tx)
  if (invoiceId) await attachReservationsToInvoice(quote.gigId, invoiceId, tx)
  await tx.insert(auditLogs).values({
    userId: input.userId ?? null, entityType: 'gig', entityId: quote.gigId, action: 'reservation_paid',
    metadata: { quoteId: quote.id, provider: input.provider, amountCents: quote.reservationCents },
  })
}
