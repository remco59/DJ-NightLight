import { asc, eq } from 'drizzle-orm'
import { clients, gigs, quoteLineItems, quotes } from '../../db/schema'
import { calculateInvoiceTotals, calculateLineTotalCents, type InvoiceSnapshot } from '../../shared/invoice'
import { quoteReservation, reservationCents, reservationProblem } from '../../shared/reservation'
import { db } from './db'
import { gigTitleSql } from './gig-title'
import type { loadBusinessSettings } from './invoice-finalize'

type BusinessSettings = NonNullable<Awaited<ReturnType<typeof loadBusinessSettings>>>

export async function getQuoteDetail(id: string) {
  const [quote] = await db.select({
    id: quotes.id,
    gigId: quotes.gigId,
    clientId: quotes.clientId,
    quoteNumber: quotes.quoteNumber,
    status: quotes.status,
    issueDate: quotes.issueDate,
    validUntil: quotes.validUntil,
    currency: quotes.currency,
    vatMode: quotes.vatMode,
    vatRateBasisPoints: quotes.vatRateBasisPoints,
    subtotalCents: quotes.subtotalCents,
    vatAmountCents: quotes.vatAmountCents,
    totalCents: quotes.totalCents,
    terms: quotes.terms,
    notes: quotes.notes,
    documentSnapshot: quotes.documentSnapshot,
    documentHash: quotes.documentHash,
    sentAt: quotes.sentAt,
    acceptedAt: quotes.acceptedAt,
    acceptedName: quotes.acceptedName,
    declinedAt: quotes.declinedAt,
    declineReason: quotes.declineReason,
    voidedAt: quotes.voidedAt,
    invoiceId: quotes.invoiceId,
    acceptedTermsVersionId: quotes.acceptedTermsVersionId,
    bookingConfirmedAt: quotes.bookingConfirmedAt,
    reservationMode: quotes.reservationMode,
    reservationValue: quotes.reservationValue,
    reservationCents: quotes.reservationCents,
    reservationPaidAt: quotes.reservationPaidAt,
    createdAt: quotes.createdAt,
    updatedAt: quotes.updatedAt,
    gigTitle: gigTitleSql(),
    gigStartsAt: gigs.startsAt,
    clientFirstName: clients.firstName,
    clientLastName: clients.lastName,
    clientCompanyName: clients.companyName,
    clientEmail: clients.email,
    clientBillingAddress: clients.billingAddress,
  }).from(quotes)
    .innerJoin(gigs, eq(quotes.gigId, gigs.id))
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .where(eq(quotes.id, id)).limit(1)
  if (!quote) return null
  const lines = await db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, id)).orderBy(asc(quoteLineItems.ordering))
  return { quote, lines }
}

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>

export function quoteClientName(quote: { clientCompanyName: string | null, clientFirstName: string | null, clientLastName: string | null }) {
  return quote.clientCompanyName || [quote.clientFirstName, quote.clientLastName].filter(Boolean).join(' ') || 'Klant'
}

export function quoteLineInputs(detail: QuoteDetail) {
  return detail.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents }))
}

/** The frozen document for a sent quote. It reuses the invoice snapshot, so the invoice PDF layout serves for quotes too. */
export function buildQuoteSnapshot(detail: QuoteDetail, settings: BusinessSettings, quoteNumber: string, portalUrl?: string): InvoiceSnapshot {
  const lineInputs = quoteLineInputs(detail)
  const { quote } = detail
  return {
    documentKind: 'quote',
    invoiceNumber: quoteNumber,
    issueDate: quote.issueDate,
    dueDate: quote.validUntil,
    serviceDate: quote.gigStartsAt ? new Date(quote.gigStartsAt).toISOString().slice(0, 10) : undefined,
    currency: quote.currency,
    vatMode: quote.vatMode,
    vatRateBasisPoints: quote.vatRateBasisPoints,
    business: {
      companyName: settings.companyName, address: settings.address, postalCode: settings.postalCode, city: settings.city,
      country: settings.country, email: settings.email, phone: settings.phone, registrationNumber: settings.registrationNumber,
      vatNumber: settings.vatNumber, iban: settings.iban,
    },
    client: { name: quoteClientName(quote), email: quote.clientEmail || '', billingAddress: quote.clientBillingAddress || '' },
    lines: lineInputs.map(line => ({ ...line, totalCents: calculateLineTotalCents(line) })),
    totals: calculateInvoiceTotals(lineInputs, quote.vatMode, quote.vatRateBasisPoints),
    paymentTerms: quote.terms,
    legalText: '',
    notes: quote.notes,
    portalUrl: portalUrl || undefined,
    reservationCents: reservationCents(calculateInvoiceTotals(lineInputs, quote.vatMode, quote.vatRateBasisPoints).totalCents, quoteReservation(quote)) || undefined,
  }
}

/** Problems that make a quote wrong or unsendable. Sending locks it, so these block it. */
export function quoteSendBlockers(detail: QuoteDetail, settings: BusinessSettings | null, today: string) {
  const blockers: string[] = []
  const lines = quoteLineInputs(detail)
  if (!lines.length) blockers.push('De offerte heeft nog geen regels.')
  if (lines.some(line => !line.description.trim())) blockers.push('Niet elke offerteregel heeft een omschrijving.')
  let totalCents = 0
  try {
    totalCents = calculateInvoiceTotals(lines, detail.quote.vatMode, detail.quote.vatRateBasisPoints).totalCents
  }
  catch {
    blockers.push('De bedragen op de offerte kloppen niet.')
  }
  if (lines.length && totalCents <= 0) blockers.push('Het totaalbedrag is € 0,00.')
  const reservationIssue = totalCents > 0 ? reservationProblem(totalCents, quoteReservation(detail.quote)) : null
  if (reservationIssue) blockers.push(reservationIssue)
  if (detail.quote.validUntil < today) blockers.push('De geldigheidsdatum ligt al in het verleden.')
  if (!detail.quote.clientId) blockers.push('Koppel eerst een klant aan de gig.')
  if (!settings?.companyName.trim()) blockers.push('Je bedrijfsnaam ontbreekt in de instellingen.')
  return blockers
}
