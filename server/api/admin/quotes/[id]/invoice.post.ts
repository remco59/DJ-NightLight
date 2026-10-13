import { and, eq, isNull } from 'drizzle-orm'
import { auditLogs, businessSettings, invoiceLineItems, invoices, quotes } from '../../../../../db/schema'
import { calculateInvoiceTotals } from '../../../../../shared/invoice'
import { db } from '../../../../utils/db'
import { getQuoteDetail, quoteLineInputs } from '../../../../utils/quote-data'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

function dateOnly(value: Date) { return value.toISOString().slice(0, 10) }

/** Turns an accepted quote into a draft invoice with the same lines and VAT. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const detail = await getQuoteDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })
  const { quote } = detail
  if (quote.status !== 'accepted') throw createError({ statusCode: 409, statusMessage: 'Alleen een geaccepteerde offerte kan een factuur worden' })
  if (quote.invoiceId) throw createError({ statusCode: 409, statusMessage: 'Voor deze offerte is al een factuur gemaakt', data: { invoiceId: quote.invoiceId } })
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })

  const lines = quoteLineInputs(detail)
  const totals = calculateInvoiceTotals(lines, quote.vatMode, quote.vatRateBasisPoints)
  const issue = quote.gigStartsAt ? new Date(quote.gigStartsAt) : new Date()
  const due = new Date(issue)
  due.setUTCDate(due.getUTCDate() + settings.defaultPaymentTermDays)

  const invoice = await db.transaction(async (tx) => {
    const [created] = await tx.insert(invoices).values({
      gigId: quote.gigId, clientId: quote.clientId, issueDate: dateOnly(issue), dueDate: dateOnly(due), currency: quote.currency,
      vatMode: quote.vatMode, vatRateBasisPoints: quote.vatRateBasisPoints, ...totals,
      paymentTerms: settings.paymentTerms, legalText: settings.legalText,
      notes: quote.quoteNumber ? `Op basis van offerte ${quote.quoteNumber}` : '',
    }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Factuur aanmaken is niet gelukt' })
    await tx.insert(invoiceLineItems).values(lines.map((line, ordering) => ({ invoiceId: created.id, ...line, ordering })))
    // Guard against two clicks: only the first one links its invoice.
    const [linked] = await tx.update(quotes).set({ invoiceId: created.id, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), isNull(quotes.invoiceId))).returning({ id: quotes.id })
    if (!linked) throw createError({ statusCode: 409, statusMessage: 'Voor deze offerte is al een factuur gemaakt' })
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: created.id, action: 'invoice_created', metadata: { gigId: quote.gigId, quoteId: id } })
    return created
  })
  event.node.res.statusCode = 201
  return { invoice }
})
