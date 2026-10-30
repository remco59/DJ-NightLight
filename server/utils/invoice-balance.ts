import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { invoices, quotes, reservationPayments } from '../../db/schema'
import { invoiceAmountDueCents } from '../../shared/invoice'
import { db } from './db'

type Db = Pick<typeof db, 'select' | 'update'>

/** The reservation payments that count as already paid on this invoice. */
export async function getInvoicePrepayments(invoiceId: string, client: Db = db) {
  const rows = await client.select({
    amountCents: reservationPayments.amountCents,
    paidAt: reservationPayments.paidAt,
    quoteNumber: quotes.quoteNumber,
  }).from(reservationPayments)
    .innerJoin(quotes, eq(reservationPayments.quoteId, quotes.id))
    .where(and(eq(reservationPayments.invoiceId, invoiceId), eq(reservationPayments.status, 'succeeded')))
    .orderBy(asc(reservationPayments.paidAt))
  return rows.map(row => ({
    label: row.quoteNumber ? `reservering ${row.quoteNumber}` : 'reservering',
    paidOn: (row.paidAt ?? new Date()).toISOString().slice(0, 10),
    amountCents: row.amountCents,
  }))
}

/** What the client still has to pay on an invoice: the total minus the reservation they paid earlier. */
export async function getInvoiceAmountDue(invoice: { id: string, totalCents: number }, client: Db = db) {
  const prepayments = await getInvoicePrepayments(invoice.id, client)
  return { prepayments, paidCents: prepayments.reduce((sum, payment) => sum + payment.amountCents, 0), amountDueCents: invoiceAmountDueCents(invoice.totalCents, prepayments) }
}

/**
 * Links paid reservations of a gig to its invoice, so they count as a partial payment on it.
 * Only reservations that are not on an invoice yet are linked.
 */
export async function attachReservationsToInvoice(gigId: string, invoiceId: string, client: Db = db) {
  const gigQuotes = client.select({ id: quotes.id }).from(quotes).where(eq(quotes.gigId, gigId))
  const attached = await client.update(reservationPayments).set({ invoiceId, updatedAt: new Date() })
    .where(and(inArray(reservationPayments.quoteId, gigQuotes), eq(reservationPayments.status, 'succeeded'), isNull(reservationPayments.invoiceId)))
    .returning({ id: reservationPayments.id })
  return attached.length
}

/** The newest invoice of a gig that can still take a partial payment: not voided. */
export async function latestOpenInvoiceId(gigId: string, client: Db = db) {
  const [invoice] = await client.select({ id: invoices.id }).from(invoices)
    .where(and(eq(invoices.gigId, gigId), inArray(invoices.status, ['draft', 'finalized'])))
    .orderBy(desc(invoices.createdAt)).limit(1)
  return invoice?.id ?? null
}
