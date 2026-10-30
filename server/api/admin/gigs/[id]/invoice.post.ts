import { and, eq, isNull } from 'drizzle-orm'
import { auditLogs, businessSettings, expenses, gigs, invoiceLineItems, invoices } from '../../../../../db/schema'
import { billableInvoiceLine } from '../../../../../shared/finance'
import { calculateInvoiceTotals } from '../../../../../shared/invoice'
import { db } from '../../../../utils/db'
import { gigTitleSql } from '../../../../utils/gig-title'
import { attachReservationsToInvoice } from '../../../../utils/invoice-balance'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

function dateOnly(value: Date) { return value.toISOString().slice(0, 10) }

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const [row] = await db.select({ gig: gigs, displayTitle: gigTitleSql() }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  const { gig, displayTitle } = row
  if (!gig.clientId) throw createError({ statusCode: 422, statusMessage: 'Koppel eerst een klant voordat je een factuur maakt' })
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })

  const issue = gig.startsAt ? new Date(gig.startsAt) : new Date()
  const due = new Date(issue); due.setUTCDate(due.getUTCDate() + settings.defaultPaymentTermDays)
  const unitPriceCents = Math.round(Number(gig.fee || 0) * 100)
  // Costs and trips marked "doorberekenen" that are not on an invoice yet become extra lines.
  const passedOn = await db.select().from(expenses).where(and(eq(expenses.gigId, gigId), eq(expenses.billable, true), isNull(expenses.billedInvoiceId))).orderBy(expenses.spentOn, expenses.createdAt)
  const lines = [
    { description: `DJ-diensten — ${displayTitle}`, quantity: '1.000', unitPriceCents },
    ...passedOn.map(expense => billableInvoiceLine(expense, settings.defaultVatMode)),
  ]
  const totals = calculateInvoiceTotals(lines, settings.defaultVatMode, settings.defaultVatRateBasisPoints)

  const invoice = await db.transaction(async (tx) => {
    const [created] = await tx.insert(invoices).values({
      gigId: gig.id, clientId: gig.clientId, issueDate: dateOnly(issue), dueDate: dateOnly(due), currency: gig.currency,
      vatMode: settings.defaultVatMode, vatRateBasisPoints: settings.defaultVatRateBasisPoints,
      ...totals, paymentTerms: settings.paymentTerms, legalText: settings.legalText,
    }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Factuur aanmaken is niet gelukt' })
    await tx.insert(invoiceLineItems).values(lines.map((line, ordering) => ({ invoiceId: created.id, ...line, ordering })))
    await attachReservationsToInvoice(gigId, created.id, tx)
    for (const expense of passedOn) await tx.update(expenses).set({ billedInvoiceId: created.id }).where(eq(expenses.id, expense.id))
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: created.id, action: 'invoice_created', metadata: { gigId } })
    return created
  })
  return { invoice }
})
