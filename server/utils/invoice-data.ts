import { asc, eq } from 'drizzle-orm'
import { clients, gigs, invoiceLineItems, invoices, payments } from '../../db/schema'
import { db } from './db'

export async function getInvoiceDetail(id: string) {
  const [invoice] = await db.select({
    id: invoices.id,
    gigId: invoices.gigId,
    clientId: invoices.clientId,
    invoiceNumber: invoices.invoiceNumber,
    status: invoices.status,
    paymentStatus: invoices.paymentStatus,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    currency: invoices.currency,
    vatMode: invoices.vatMode,
    vatRateBasisPoints: invoices.vatRateBasisPoints,
    subtotalCents: invoices.subtotalCents,
    vatAmountCents: invoices.vatAmountCents,
    totalCents: invoices.totalCents,
    paymentTerms: invoices.paymentTerms,
    legalText: invoices.legalText,
    notes: invoices.notes,
    documentSnapshot: invoices.documentSnapshot,
    documentHash: invoices.documentHash,
    finalizedAt: invoices.finalizedAt,
    voidedAt: invoices.voidedAt,
    replacementForInvoiceId: invoices.replacementForInvoiceId,
    createdAt: invoices.createdAt,
    updatedAt: invoices.updatedAt,
    gigTitle: gigs.title,
    gigStartsAt: gigs.startsAt,
    clientType: clients.type,
    clientFirstName: clients.firstName,
    clientLastName: clients.lastName,
    clientCompanyName: clients.companyName,
    clientStripeCustomerId: clients.stripeCustomerId,
    clientEmail: clients.email,
    clientBillingAddress: clients.billingAddress,
  }).from(invoices)
    .innerJoin(gigs, eq(invoices.gigId, gigs.id))
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, id)).limit(1)
  if (!invoice) return null
  const lines = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(asc(invoiceLineItems.ordering))
  const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, id)).limit(1)
  return { invoice, lines, payment: payment ?? null }
}

export function invoiceClientName(invoice: { clientCompanyName: string | null, clientFirstName: string | null, clientLastName: string | null }) {
  return invoice.clientCompanyName || [invoice.clientFirstName, invoice.clientLastName].filter(Boolean).join(' ') || 'Client'
}
